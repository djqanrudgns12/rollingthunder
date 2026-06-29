-- 003_create_participants.sql
-- 게임 참가자 정보

CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    icon_url TEXT,
    skin_id TEXT
);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- 세션과 동일한 읽기 정책
CREATE POLICY "participants_select_policy" 
ON participants FOR SELECT 
TO public 
USING (true);

-- 참가자 생성은 해당 세션의 생성자만 가능하도록 할 수 있으나
-- 단순화를 위해 세션 생성 권한과 유사하게 설정하거나 
-- 세션 id를 조인해서 검증할 수 있음. 
-- 여기서는 일단 authenticated로 제한
CREATE POLICY "participants_insert_policy" 
ON participants FOR INSERT 
TO authenticated 
WITH CHECK (true);
