-- 016_sync_and_inventory.sql
-- 게스트 데이터(칩, 인벤토리, 장착 아이템) 연동 및 서버 인벤토리 마이그레이션

-- 1. profiles 테이블에 장착 상태(Equipped) 컬럼 추가
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS equipped_skin VARCHAR(100),
ADD COLUMN IF NOT EXISTS equipped_avatar VARCHAR(100),
ADD COLUMN IF NOT EXISTS equipped_border VARCHAR(100),
ADD COLUMN IF NOT EXISTS equipped_piece VARCHAR(100),
ADD COLUMN IF NOT EXISTS equipped_background VARCHAR(100),
ADD COLUMN IF NOT EXISTS equipped_frame VARCHAR(100);

-- 2. handle_new_user 트리거 함수 재정의 (초기 칩 및 인벤토리 파싱 로직 포함)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_initial_chips BIGINT := 0;
    v_inventory JSONB;
    v_equipped JSONB;
    v_item_code TEXT;
    v_item_type TEXT;
BEGIN
    -- 1) 초기 칩 파싱 (게스트 시절 보유한 칩)
    IF new.raw_user_meta_data ? 'guest_chips' THEN
        v_initial_chips := COALESCE((new.raw_user_meta_data->>'guest_chips')::BIGINT, 0);
    END IF;

    -- 2) 장착 아이템 파싱
    v_equipped := new.raw_user_meta_data->'guest_equipped';

    -- 3) profiles에 INSERT (최초 칩 잔액 및 누적 칩 반영)
    INSERT INTO public.profiles (
        id, 
        username, 
        name, 
        role, 
        chips_balance, 
        total_earned_chips,
        equipped_skin,
        equipped_avatar,
        equipped_border,
        equipped_piece,
        equipped_background,
        equipped_frame
    )
    VALUES (
        new.id, 
        new.raw_user_meta_data->>'username', 
        new.raw_user_meta_data->>'name', 
        'user',
        v_initial_chips,
        v_initial_chips,
        v_equipped->>'skin',
        v_equipped->>'avatar',
        v_equipped->>'border',
        v_equipped->>'piece',
        v_equipped->>'background',
        v_equipped->>'frame'
    );

    -- 4) 인벤토리(보유 아이템) 파싱 및 user_inventory 일괄 INSERT
    IF new.raw_user_meta_data ? 'guest_inventory' THEN
        v_inventory := new.raw_user_meta_data->'guest_inventory';
        
        IF jsonb_typeof(v_inventory) = 'array' THEN
            FOR v_item_code IN SELECT * FROM jsonb_array_elements_text(v_inventory)
            LOOP
                v_item_type := split_part(v_item_code, '_', 1);
                
                INSERT INTO public.user_inventory (user_id, item_type, item_code)
                VALUES (new.id, v_item_type, v_item_code)
                ON CONFLICT (user_id, item_type, item_code) DO NOTHING;
            END LOOP;
        END IF;
    END IF;

    -- 칩 연동이 발생했다면, chip_logs 에도 초기 연동 로그 기록
    IF v_initial_chips > 0 THEN
        INSERT INTO public.chip_logs (user_id, amount, reason)
        VALUES (new.id, v_initial_chips, 'guest_sync');
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
