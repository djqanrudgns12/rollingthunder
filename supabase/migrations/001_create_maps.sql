-- 001_create_maps.sql
-- 맵 데이터 저장용 테이블 (에디터 연동)

CREATE TABLE IF NOT EXISTS maps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    length_type TEXT DEFAULT 'Middle',
    complexity TEXT DEFAULT 'Medium',
    world_height INTEGER DEFAULT 2400,
    wall_style TEXT DEFAULT 'straight',
    bg_image TEXT,
    theme_weights JSONB DEFAULT '{}'::jsonb,
    layout_config JSONB DEFAULT '{}'::jsonb,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 정책 활성화
ALTER TABLE maps ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "maps_select_policy" 
ON maps FOR SELECT 
TO public 
USING (true);

-- 인증된 사용자는 맵 생성/수정 가능 (차후 admin role 검증으로 강화 가능)
CREATE POLICY "maps_insert_policy" 
ON maps FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "maps_update_policy" 
ON maps FOR UPDATE 
TO authenticated 
USING (true);

-- 기본 프리셋 인서트 (초기 맵 데이터가 없을 경우를 대비해 랜덤/기본 맵을 심을 수 있지만 현재는 생략)
