-- 004_create_results.sql
-- 게임 결과 

CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    score NUMERIC
);

ALTER TABLE results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "results_select_policy" 
ON results FOR SELECT 
TO public 
USING (true);

CREATE POLICY "results_insert_policy" 
ON results FOR INSERT 
TO authenticated 
WITH CHECK (true);
