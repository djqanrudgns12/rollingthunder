-- 002_create_sessions.sql
-- 게임 세션 저장용 테이블

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (결과 공유용)
CREATE POLICY "sessions_select_policy" 
ON sessions FOR SELECT 
TO public 
USING (true);

-- 세션 생성자는 자신만 가능
CREATE POLICY "sessions_insert_policy" 
ON sessions FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_update_policy" 
ON sessions FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);
