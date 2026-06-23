-- Phase 7 커스텀 맵 및 가챠 시스템을 위한 Supabase 스키마 업데이트

-- 1. 커스텀 맵 저장 테이블
CREATE TABLE IF NOT EXISTS public.map_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT,
  title TEXT NOT NULL,
  map_data JSONB NOT NULL,
  share_code TEXT UNIQUE,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 유저별 스킨 파츠 인벤토리
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id TEXT NOT NULL, -- 또는 로그인한 user_id
  part_type TEXT NOT NULL,      -- 'body', 'trail', 'effect' 등 분류
  item_id TEXT NOT NULL,        -- 에셋 고유 ID (예: 'UR_blackhole')
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 가챠 확률 검증용 감사 로그 (무결성 보장)
CREATE TABLE IF NOT EXISTS public.gacha_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id TEXT NOT NULL,
  cost INTEGER NOT NULL,
  reward_tier TEXT NOT NULL,
  reward_item_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) 활성화
ALTER TABLE public.map_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_logs ENABLE ROW LEVEL SECURITY;

-- 퍼블릭 접속 권한 허용 (초기 테스트용, 향후 auth.uid() 정책으로 고도화)
CREATE POLICY "Anyone can read map_presets" ON public.map_presets FOR SELECT USING (true);
CREATE POLICY "Anyone can insert map_presets" ON public.map_presets FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read inventory" ON public.user_inventory FOR SELECT USING (true);
CREATE POLICY "Anyone can insert inventory" ON public.user_inventory FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read gacha_logs" ON public.gacha_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert gacha_logs" ON public.gacha_logs FOR INSERT WITH CHECK (true);
