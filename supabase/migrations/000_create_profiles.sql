-- 000_create_profiles.sql
-- 유저 프로필 및 권한(Role) 관리 테이블

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'premium', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 정책 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 누구나 자신의 프로필을 읽을 수 있음
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING ( auth.uid() = id );

-- 프로필 자동 생성을 위한 DB 트리거 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'name', 
    'user'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users 에 insert 발생 시 트리거 실행
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
