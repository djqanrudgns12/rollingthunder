-- =============================================================
-- 017: 가챠 로그 테이블 신설 + user_inventory INSERT 정책 보강
--
-- 배경:
--  1) /api/gacha 라우트가 gacha_logs 테이블에 기록을 시도하지만
--     테이블이 어떤 마이그레이션에도 존재하지 않아 가챠 API가 항상 실패했다.
--  2) user_inventory 에는 SELECT 정책(007)만 있고 INSERT 정책이 없어,
--     상점 구매(purchaseShopItem)에서 칩 차감(RPC, SECURITY DEFINER)은
--     성공하고 아이템 지급 INSERT 는 RLS 에 막히는 정합 붕괴가 가능했다.
-- =============================================================

-- 1. 가챠 감사 로그
CREATE TABLE IF NOT EXISTS public.gacha_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    cost BIGINT NOT NULL DEFAULT 0,
    reward_tier VARCHAR(10) NOT NULL,        -- 'N' | 'R' | 'SR' | 'UR'
    reward_item_code VARCHAR(100) NOT NULL,  -- 예: 'UR_blackhole'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gacha_logs_user
    ON public.gacha_logs (user_id, created_at DESC);

ALTER TABLE public.gacha_logs ENABLE ROW LEVEL SECURITY;

-- 본인 로그만 조회/기록 (기록은 인증 세션을 사용하는 서버 라우트 경유)
DROP POLICY IF EXISTS "gacha_logs_select_own" ON public.gacha_logs;
CREATE POLICY "gacha_logs_select_own" ON public.gacha_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "gacha_logs_insert_own" ON public.gacha_logs;
CREATE POLICY "gacha_logs_insert_own" ON public.gacha_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. user_inventory INSERT 정책 (본인 인벤토리에만 지급 가능)
DROP POLICY IF EXISTS "Users can insert own inventory" ON public.user_inventory;
CREATE POLICY "Users can insert own inventory" ON public.user_inventory
    FOR INSERT WITH CHECK (auth.uid() = user_id);
