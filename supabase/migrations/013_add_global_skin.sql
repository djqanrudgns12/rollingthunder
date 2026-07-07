-- 013_add_global_skin.sql
-- 스킨 일괄 설정(globalSkin)을 서버에 영속화하여 기기 간 동기화
-- (기존에는 localStorage에만 저장되어 새 기기/재로그인 시 이전 스킨이 복원되지 않았음)

ALTER TABLE public.user_current_roster
  ADD COLUMN IF NOT EXISTS global_skin TEXT;
