-- =============================================================
-- 017: 가챠 로그 테이블 스키마 정렬 + user_inventory INSERT 정책 보강
--
-- 배경:
--  1) gacha_logs 테이블이 마이그레이션에 없이 라이브 DB 에 수동 생성돼 있었고,
--     예전 가챠 라우트가 쓰던 구 스키마(participant_id TEXT / reward_item_id)였다.
--     그 라우트는 participant_id 를 'guest_user_1' 로 하드코딩해 실제 유저와
--     연결되지 않은 테스트 로그만 남겼으므로 보존 가치가 없다.
--     신 라우트는 인증 세션(user_id) + deduct_chips RPC 기준으로 재작성되었으므로,
--     구 테이블을 폐기하고 신 스키마로 재생성한다.
--  2) user_inventory 에 명시적 INSERT 정책을 보강한다(idempotent).
--     상점 구매는 현재 정상 동작하나, 정책을 마이그레이션으로 고정해 재현성을 확보한다.
--
-- ⚠️ 이 스크립트는 구 gacha_logs(테스트 로그)를 DROP 한다. 실제 유저 데이터는 없다.
-- =============================================================

-- 1. 구 가챠 로그 폐기 후 신 스키마로 재생성
--    (감사 로그이며 다른 테이블이 참조하지 않으므로 CASCADE 로 정책/인덱스까지 정리)
DROP TABLE IF EXISTS public.gacha_logs CASCADE;

CREATE TABLE public.gacha_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    cost BIGINT NOT NULL DEFAULT 0,
    reward_tier VARCHAR(10) NOT NULL,        -- 'N' | 'R' | 'SR' | 'UR'
    reward_item_code VARCHAR(100) NOT NULL,  -- 예: 'UR_blackhole'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gacha_logs_user
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
