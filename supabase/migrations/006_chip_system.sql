-- 006_chip_system.sql
-- 칩(Chip) 시스템 마이그레이션: 재화 필드, 로깅 테이블, 트랜잭션 함수

-- 1. profiles 테이블 확장
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS chips BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earned_chips BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent_chips BIGINT DEFAULT 0;

-- 2. chip_logs 테이블 생성
CREATE TABLE IF NOT EXISTS public.chip_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.chip_logs ENABLE ROW LEVEL SECURITY;

-- 유저는 자신의 칩 로그만 볼 수 있음
CREATE POLICY "Users can view own chip logs" 
    ON public.chip_logs FOR SELECT 
    USING ( auth.uid() = user_id );

-- 3. 칩 획득 RPC (Transaction 처리)
CREATE OR REPLACE FUNCTION public.add_chips(p_user_id UUID, p_amount BIGINT, p_reason TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_current_chips BIGINT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;

    -- Row-level lock 획득
    SELECT chips INTO v_current_chips
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    -- 프로필 업데이트
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

-- 4. 칩 소모 RPC (Transaction 처리)
CREATE OR REPLACE FUNCTION public.deduct_chips(p_user_id UUID, p_amount BIGINT, p_reason TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_current_chips BIGINT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;

    -- Row-level lock 획득
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

    -- 프로필 업데이트
    UPDATE public.profiles
    SET chips = chips - p_amount,
        total_spent_chips = total_spent_chips + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING chips INTO v_current_chips;

    -- 로그 기록 (소모는 음수로 기록할 수도 있으나, 여기서는 일관되게 -amount 로 기록)
    INSERT INTO public.chip_logs (user_id, amount, reason)
    VALUES (p_user_id, -p_amount, p_reason);

    RETURN v_current_chips;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
