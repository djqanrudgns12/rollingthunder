-- 020_add_nickname.sql
-- 프로필 테이블에 닉네임(nickname) 컬럼 추가 및 트리거 갱신

-- 1. nickname 컬럼 추가 (nullable — 기존 계정 호환)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname TEXT;

-- 2. 트리거 함수 갱신: 회원가입 시 nickname 메타데이터도 삽입
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, nickname, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'nickname',
    'user'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
