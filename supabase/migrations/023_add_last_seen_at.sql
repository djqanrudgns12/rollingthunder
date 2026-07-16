-- 023_add_last_seen_at.sql
-- profiles 테이블에 last_seen_at 컬럼 추가 및 접속 추적 RPC 함수 생성
--
-- 배경:
--   auth.users.last_sign_in_at 는 signInWithPassword() 호출 시에만 갱신되며,
--   세션 토큰 자동 갱신이나 페이지 재방문 시에는 업데이트되지 않는다.
--   따라서 "마지막 접속일"을 정확하게 추적하기 위해 앱 레벨의 커스텀 컬럼을 사용한다.
--
-- 갱신 방식:
--   클라이언트 측 훅(useLastSeenSync)에서 5분 간격으로 touch_last_seen() RPC를 호출하여
--   현재 세션의 유저 last_seen_at 을 갱신한다.

-- ─────────────────────────────────────────────
-- 1. profiles 테이블에 last_seen_at 컬럼 추가
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- 기존 유저: auth.users.last_sign_in_at 값으로 초기화 (마이그레이션 시점의 최선)
UPDATE public.profiles p
SET last_seen_at = u.last_sign_in_at
FROM auth.users u
WHERE p.id = u.id AND p.last_seen_at IS NULL;

-- ─────────────────────────────────────────────
-- 2. touch_last_seen() — 접속 시각 갱신 RPC
-- ─────────────────────────────────────────────
-- SECURITY DEFINER로 실행하여 RLS를 우회한다.
-- auth.uid()를 강제 사용하므로 타인의 last_seen_at를 조작할 수 없다.
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET last_seen_at = NOW()
    WHERE id = auth.uid();
END;
$$;
