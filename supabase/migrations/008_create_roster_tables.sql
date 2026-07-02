-- 008_create_roster_tables.sql
-- 로그인 회원의 참가자 명단 서버 동기화 및 관리 테이블

-- 1. 현재 진행 중인/등록된 참가자 명단 테이블 (1:1 per user)
CREATE TABLE IF NOT EXISTS public.user_current_roster (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_current_roster ENABLE ROW LEVEL SECURITY;

-- 자신의 Roster만 CRUD 가능
CREATE POLICY "user_current_roster_select_policy" 
ON public.user_current_roster FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "user_current_roster_insert_policy" 
ON public.user_current_roster FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_current_roster_update_policy" 
ON public.user_current_roster FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "user_current_roster_delete_policy" 
ON public.user_current_roster FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- 2. 명단 관리 탭에서 저장한 명단 그룹 테이블 (1:N per user)
CREATE TABLE IF NOT EXISTS public.participant_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.participant_lists ENABLE ROW LEVEL SECURITY;

-- 자신의 명단 그룹만 CRUD 가능
CREATE POLICY "participant_lists_select_policy" 
ON public.participant_lists FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "participant_lists_insert_policy" 
ON public.participant_lists FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "participant_lists_update_policy" 
ON public.participant_lists FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "participant_lists_delete_policy" 
ON public.participant_lists FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- Realtime 동기화를 위해 테이블 publication 추가
BEGIN;
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_current_roster';
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_lists';
    END IF;
  END
  $$;
COMMIT;
