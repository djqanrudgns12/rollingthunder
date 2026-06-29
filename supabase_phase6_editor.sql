-- Phase 6: 인게임 맵 에디터용 커스텀 맵 테이블

-- 1. 커스텀 맵 저장 테이블
CREATE TABLE IF NOT EXISTS public.maps (
  id TEXT PRIMARY KEY, -- ex) 'neon_arcade', 'custom_1'
  name TEXT NOT NULL,
  description TEXT,
  length_type TEXT DEFAULT 'Middle', -- 'Short' | 'Middle' | 'Long'
  complexity TEXT DEFAULT 'Medium', -- 'Simple' | 'Medium' | 'Complex'
  world_height INTEGER DEFAULT 2400,
  wall_style TEXT DEFAULT 'straight',
  bg_image TEXT,
  theme_weights JSONB DEFAULT '{}'::jsonb,
  layout_config JSONB DEFAULT '{}'::jsonb,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) 활성화
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;

-- 퍼블릭(누구나) 맵 데이터 조회 가능 (게임 플레이용)
CREATE POLICY "Anyone can read maps" 
  ON public.maps 
  FOR SELECT 
  USING (true);

-- 관리자(Admin)만 맵 데이터 수정/삽입 가능 (에디터 전용 보안)
-- 주의: 추후 auth.users 나 profiles 테이블과 연동하여 admin 검증 로직으로 고도화 필요
CREATE POLICY "Admins can insert and update maps" 
  ON public.maps 
  FOR ALL 
  USING (
    -- 임시로 true로 열어둡니다. 실제 운영 시 다음과 같이 변경:
    -- (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    true 
  );
