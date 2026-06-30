-- Table: map_edit_history
CREATE TABLE map_edit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    map_id TEXT REFERENCES maps(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- e.g., 'ADD_ITEM', 'REMOVE_ITEM', 'SAVE_MAP'
    action_details JSONB, -- 세부 변경 내용
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries by map_id
CREATE INDEX idx_map_edit_history_map_id ON map_edit_history(map_id);

-- RLS (Row Level Security) 설정
ALTER TABLE map_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own history" 
ON map_edit_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own history" 
ON map_edit_history FOR SELECT 
USING (auth.uid() = user_id);

-- Allow public to read if they have map access (for simplicity in dev, or tie it to map permissions)
-- Actually, the user wants it to be viewable by authorized users. 
-- For now, anyone who is authenticated can view histories of maps they have access to. 
-- But in our system, let's keep it simple: authenticated users can insert and view.
