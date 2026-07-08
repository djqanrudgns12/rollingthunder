-- 014_admin_policies.sql
-- 관리자 전용 권한 확인 함수 및 우회 정책 (Nexus Admin)

-- 1. 관리자 확인을 위한 SECURITY DEFINER 함수
-- RLS 재귀 호출 문제를 방지하고 안전하게 role을 검사합니다.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. profiles 테이블에 대한 관리자 정책
-- 기존 정책("Users can view own profile")과 충돌하지 않도록 OR 조건처럼 동작합니다.
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (public.is_admin());

-- 3. chip_logs 테이블에 대한 관리자 정책
-- 관리자가 경제 흐름 전체를 추적할 수 있도록 허용합니다.
CREATE POLICY "Admins can view all chip logs" 
ON public.chip_logs FOR SELECT 
USING (public.is_admin());
