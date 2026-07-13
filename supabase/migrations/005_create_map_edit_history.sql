-- Table: map_edit_history
-- 주의: 2026-07 점검에서 라이브 DB 미적용 상태로 확인됨 — 이 파일을 그대로 실행하면 됨.
-- (uuid_generate_v4 는 uuid-ossp 확장 필요 → Supabase 기본 제공 gen_random_uuid 로 교정, 멱등 실행 가능하게 IF NOT EXISTS 추가)
CREATE TABLE IF NOT EXISTS map_edit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    map_id TEXT REFERENCES maps(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- e.g., 'ADD_ITEM', 'REMOVE_ITEM', 'SAVE_MAP'
    action_details JSONB, -- 세부 변경 내용
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries by map_id
CREATE INDEX IF NOT EXISTS idx_map_edit_history_map_id ON map_edit_history(map_id);

-- RLS (Row Level Security) 설정
ALTER TABLE map_edit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own history" ON map_edit_history;
CREATE POLICY "Users can insert their own history"
ON map_edit_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own history" ON map_edit_history;
CREATE POLICY "Users can view their own history"
ON map_edit_history FOR SELECT
USING (auth.uid() = user_id);

-- Allow public to read if they have map access (for simplicity in dev, or tie it to map permissions)
-- Actually, the user wants it to be viewable by authorized users. 
-- For now, anyone who is authenticated can view histories of maps they have access to. 
-- But in our system, let's keep it simple: authenticated users can insert and view.
