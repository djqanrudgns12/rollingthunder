-- Phase 8: Shop System (Shop Catalog & User Inventories)

-- 1. Shop Catalog Table
CREATE TABLE IF NOT EXISTS public.shop_catalog (
    item_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('skin', 'piece', 'frame', 'background')),
    name TEXT NOT NULL,
    description TEXT,
    asset_url TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    rarity TEXT NOT NULL CHECK (rarity IN ('Common', 'Rare', 'Epic', 'Legendary')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Inventories Table
CREATE TABLE IF NOT EXISTS public.user_inventories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.shop_catalog(item_id) ON DELETE CASCADE,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(user_id, item_id) -- 방어적 설계: 유저당 같은 아이템 중복 보유 방지 (소모성 아이템이 아닌 치장성일 경우)
);

-- 3. RLS Policies
ALTER TABLE public.shop_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventories ENABLE ROW LEVEL SECURITY;

-- Shop Catalog: 누구나 조회 가능, 쓰기는 관리자만(여기서는 단순화를 위해 우선 조회만 개방)
CREATE POLICY "Shop catalog is viewable by everyone." 
ON public.shop_catalog FOR SELECT 
USING (true);

-- User Inventories: 본인의 인벤토리만 조회 및 수정 가능
CREATE POLICY "Users can view their own inventory." 
ON public.user_inventories FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own equipped status." 
ON public.user_inventories FOR UPDATE 
USING (auth.uid() = user_id);

-- 4. RPC for Buying an Item Atomically
-- 칩 차감 및 아이템 지급을 하나의 트랜잭션으로 처리
CREATE OR REPLACE FUNCTION public.buy_shop_item(p_user_id UUID, p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item_price INTEGER;
    v_item_active BOOLEAN;
    v_user_chips INTEGER;
    v_already_owned BOOLEAN;
BEGIN
    -- 1. 아이템 정보 조회
    SELECT price, is_active INTO v_item_price, v_item_active
    FROM public.shop_catalog
    WHERE item_id = p_item_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item not found.');
    END IF;

    IF NOT v_item_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item is not available for purchase.');
    END IF;

    -- 2. 중복 소유 검증
    SELECT EXISTS (
        SELECT 1 FROM public.user_inventories WHERE user_id = p_user_id AND item_id = p_item_id
    ) INTO v_already_owned;

    IF v_already_owned THEN
         RETURN jsonb_build_object('success', false, 'error', 'Already own this item.');
    END IF;

    -- 3. 잔액 확인 (동시성 방지를 위해 FOR UPDATE 활용)
    SELECT chips INTO v_user_chips
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_user_chips < v_item_price THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not enough chips.');
    END IF;

    -- 4. 칩 차감
    UPDATE public.users
    SET chips = chips - v_item_price
    WHERE id = p_user_id;

    -- 5. 아이템 지급
    INSERT INTO public.user_inventories (user_id, item_id, is_equipped)
    VALUES (p_user_id, p_item_id, FALSE);

    -- 6. 로깅 (칩 로그가 있다면 여기에 추가, 우선은 성공 반환)
    -- INSERT INTO chip_transactions_log (user_id, amount, transaction_type, description)
    -- VALUES (p_user_id, -v_item_price, 'shop_purchase', 'Bought item: ' || p_item_id);

    RETURN jsonb_build_object('success', true, 'remaining_chips', v_user_chips - v_item_price);
END;
$$;

-- 5. 목업(Mockup) 데이터 삽입 (테스트용)
INSERT INTO public.shop_catalog (category, name, description, price, rarity, asset_url)
VALUES 
('skin', 'Neon Chrome Suit', 'A shining neon suit.', 5000, 'Epic', '/assets/skins/neon_chrome.png'),
('piece', 'Golden Pawn', 'Solid gold game piece.', 10000, 'Legendary', '/assets/pieces/gold_pawn.glb'),
('frame', 'Ruby Border', 'Luxurious ruby profile border.', 2000, 'Rare', '/assets/frames/ruby.png'),
('background', 'Casino Lights', 'Vibrant casino background.', 3000, 'Epic', '/assets/bg/casino_lights.png');
