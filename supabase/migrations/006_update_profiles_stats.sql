-- 006_update_profiles_stats.sql
-- 프로필 테이블에 통계 및 재화 컬럼 추가

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chips_balance BIGINT DEFAULT 1000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_games_played INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- 기존 데이터가 있다면 기본값 채워주기
UPDATE public.profiles SET chips_balance = 1000 WHERE chips_balance IS NULL;
UPDATE public.profiles SET total_games_played = 0 WHERE total_games_played IS NULL;
UPDATE public.profiles SET login_count = 0 WHERE login_count IS NULL;
