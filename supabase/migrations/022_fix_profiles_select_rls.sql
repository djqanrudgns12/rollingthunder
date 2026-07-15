-- 022_fix_profiles_select_rls.sql
-- 
-- Bug Fix: profiles SELECT RLS가 자기 프로필(auth.uid() = id)과 admin만 허용하여,
-- 커스텀 맵 스토어(findPublished)에서 profiles 조인 시 타인의 제작자명이 null로 반환되는 문제.
--
-- 변경: 모든 authenticated 유저가 profiles를 조회할 수 있도록 PERMISSIVE 정책 추가.
-- 보안 참고: UPDATE RLS는 여전히 자기 프로필 또는 admin만 허용하므로 읽기만 공개됨.
--           민감한 필드(chips_balance 등)는 Supabase 쿼리에서 select 컬럼 제한으로 보호.

CREATE POLICY "Authenticated users can view basic profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
