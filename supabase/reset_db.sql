-- =============================================================
-- ⚠️ DEPRECATED — 실행 금지
-- 이 스크립트는 마이그레이션 006 이전 시점의 스냅샷이며,
-- 현재 코드가 사용하는 chips_balance 대신 구버전 chips 컬럼을 생성한다.
-- (007~017의 미션/스탬프/명단/맵스토어/인벤토리/가챠 테이블도 전부 누락)
-- DB 초기화가 필요하면 migrations/000~017 을 순서대로 실행할 것.
-- =============================================================

-- 기존 테이블 및 트리거 초기화
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

DROP TABLE IF EXISTS public.results CASCADE;
DROP TABLE IF EXISTS public.participants CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.maps CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. profiles 테이블 생성
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'premium', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ( auth.uid() = id );

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. maps 테이블 생성
CREATE TABLE IF NOT EXISTS public.maps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_official BOOLEAN DEFAULT false,
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

ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maps_select_policy" ON public.maps FOR SELECT TO public USING (true);
CREATE POLICY "maps_insert_policy" ON public.maps FOR INSERT WITH CHECK ( EXISTS ( SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' ) );
CREATE POLICY "maps_update_policy" ON public.maps FOR UPDATE USING ( EXISTS ( SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' ) );

-- 3. sessions 테이블 생성 (002_create_sessions.sql 내용 발췌)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions" ON public.sessions FOR ALL USING ( auth.uid() = user_id );

-- 4. participants 테이블 생성 (003_create_participants.sql 내용 발췌)
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    icon_url TEXT,
    skin_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage participants of own sessions" ON public.participants FOR ALL USING ( EXISTS ( SELECT 1 FROM public.sessions WHERE sessions.id = participants.session_id AND sessions.user_id = auth.uid() ) );

-- 5. results 테이블 생성 (004_create_results.sql 내용 발췌)
CREATE TABLE IF NOT EXISTS public.results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
    rank INTEGER,
    score NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage results of own sessions" ON public.results FOR ALL USING ( EXISTS ( SELECT 1 FROM public.sessions WHERE sessions.id = results.session_id AND sessions.user_id = auth.uid() ) );

-- 완료 메시지
-- 현재 존재하는 auth.users 유저들의 프로필 수동 생성 (이미 유저가 있다면 실행)
INSERT INTO public.profiles (id, username, name, role)
SELECT id, raw_user_meta_data->>'username', raw_user_meta_data->>'name', 'admin'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin'; -- 개발 테스트용으로 모든 기존 유저를 admin으로 승격 (원치 않으면 제외)
-- 006_chip_system.sql
-- �?Chip) ?�스??마이그레?�션: ?�화 ?�드, 로깅 ?�이�? ?�랜??�� ?�수

-- 1. profiles ?�이�??�장
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS chips BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earned_chips BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent_chips BIGINT DEFAULT 0;

-- 2. chip_logs ?�이�??�성
CREATE TABLE IF NOT EXISTS public.chip_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.chip_logs ENABLE ROW LEVEL SECURITY;

-- ?��????�신??�?로그�?�????�음
CREATE POLICY "Users can view own chip logs" 
    ON public.chip_logs FOR SELECT 
    USING ( auth.uid() = user_id );

-- 3. �??�득 RPC (Transaction 처리)
CREATE OR REPLACE FUNCTION public.add_chips(p_user_id UUID, p_amount BIGINT, p_reason TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_current_chips BIGINT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;

    -- Row-level lock ?�득
    SELECT chips INTO v_current_chips
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    -- ?�로???�데?�트
    UPDATE public.profiles
    SET chips = chips + p_amount,
        total_earned_chips = total_earned_chips + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING chips INTO v_current_chips;

    -- 로그 기록
    INSERT INTO public.chip_logs (user_id, amount, reason)
    VALUES (p_user_id, p_amount, p_reason);

    RETURN v_current_chips;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. �??�모 RPC (Transaction 처리)
CREATE OR REPLACE FUNCTION public.deduct_chips(p_user_id UUID, p_amount BIGINT, p_reason TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_current_chips BIGINT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;

    -- Row-level lock ?�득
    SELECT chips INTO v_current_chips
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    IF v_current_chips < p_amount THEN
        RAISE EXCEPTION 'Insufficient chips. Has: %, Needs: %', v_current_chips, p_amount;
    END IF;

    -- ?�로???�데?�트
    UPDATE public.profiles
    SET chips = chips - p_amount,
        total_spent_chips = total_spent_chips + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING chips INTO v_current_chips;

    -- 로그 기록 (?�모???�수�?기록???�도 ?�으?? ?�기?�는 ?��??�게 -amount �?기록)
    INSERT INTO public.chip_logs (user_id, amount, reason)
    VALUES (p_user_id, -p_amount, p_reason);

    RETURN v_current_chips;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

