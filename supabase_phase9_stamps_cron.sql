-- Phase 9: Stamp (Mission) System and pg_cron reset logic

-- 1. Enable pg_cron extension (if not already enabled)
-- Note: This requires postgres superuser privileges. In Supabase, if this fails, enable it via Dashboard -> Database -> Extensions.
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

-- 2. Create Stamps Table (Catalog)
CREATE TABLE IF NOT EXISTS public.stamps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'achievement')),
    title TEXT NOT NULL,
    description TEXT,
    target_count INTEGER NOT NULL DEFAULT 1,
    reward_chips INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create User Stamps Table (Progress Tracking)
CREATE TABLE IF NOT EXISTS public.user_stamps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stamp_id UUID NOT NULL REFERENCES public.stamps(id) ON DELETE CASCADE,
    current_count INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, stamp_id)
);

-- 4. Set RLS Policies
ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stamps catalog is viewable by everyone." 
ON public.stamps FOR SELECT USING (true);

CREATE POLICY "Users can view their own stamp progress." 
ON public.user_stamps FOR SELECT USING (auth.uid() = user_id);

-- Note: Updates to progress are usually done securely via backend/RPC, not directly from frontend.
CREATE POLICY "Users can update their own stamp progress." 
ON public.user_stamps FOR UPDATE USING (auth.uid() = user_id);

-- 5. Create Functions for cron jobs
-- Reset Daily Stamps
CREATE OR REPLACE FUNCTION public.reset_daily_stamps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.user_stamps us
    SET current_count = 0,
        is_completed = FALSE,
        is_reward_claimed = FALSE,
        updated_at = NOW()
    FROM public.stamps s
    WHERE us.stamp_id = s.id AND s.type = 'daily';
END;
$$;

-- Reset Weekly Stamps
CREATE OR REPLACE FUNCTION public.reset_weekly_stamps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.user_stamps us
    SET current_count = 0,
        is_completed = FALSE,
        is_reward_claimed = FALSE,
        updated_at = NOW()
    FROM public.stamps s
    WHERE us.stamp_id = s.id AND s.type = 'weekly';
END;
$$;

-- 6. Insert Mockup Stamp Data
INSERT INTO public.stamps (type, title, description, target_count, reward_chips)
VALUES 
('daily', '상점 방문', '상점 페이지를 1회 방문하세요.', 1, 10),
('daily', '가볍게 한 판', '게임을 1회 플레이하세요.', 1, 50),
('daily', '첫 승리', '게임에서 1회 승리하세요.', 1, 100),
('weekly', '꾸준한 플레이어', '게임을 15회 플레이하세요.', 15, 500),
('achievement', '도박사의 첫 걸음', '누적 10회 플레이를 달성하세요.', 10, 2000),
('achievement', '진정한 롤링 썬더', '누적 칩 100만개를 획득하세요.', 1, 50000);

-- 7. Schedule Cron Jobs
-- KST 자정(00:00)은 UTC 기준 전날 15:00 입니다.
-- 매일 15시 00분에 일일 미션 초기화
SELECT cron.schedule('reset-daily-kst', '0 15 * * *', $$ SELECT public.reset_daily_stamps(); $$);

-- KST 일요일 자정(00:00)은 UTC 토요일 15:00 입니다.
-- 매주 토요일 15시 00분에 주간 미션 초기화
SELECT cron.schedule('reset-weekly-kst', '0 15 * * 6', $$ SELECT public.reset_weekly_stamps(); $$);
