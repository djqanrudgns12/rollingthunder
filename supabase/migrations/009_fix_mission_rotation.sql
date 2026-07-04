-- 009_fix_mission_rotation.sql
-- 일일/주간 미션 누적 버그 수정 및 할당 개수를 5개로 증가
--
-- 문제: assign_random_missions 함수가 오래된 미션을 삭제하지 않아
--       하루/주가 지날수록 미션이 계속 쌓이는 버그 발생
-- 수정: 오래된 미션 자동 정리 + 새 미션 할당 시 LIMIT 3 → 5

CREATE OR REPLACE FUNCTION public.assign_random_missions(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- ===== 1. 오래된 일일 미션 정리 (오늘 이전 것 삭제) =====
    DELETE FROM public.user_missions
    WHERE user_id = p_user_id
      AND mission_id IN (SELECT id FROM public.missions WHERE type = 'daily')
      AND assigned_date < CURRENT_DATE;

    -- ===== 2. 오래된 주간 미션 정리 (이번 주 이전 것 삭제) =====
    DELETE FROM public.user_missions
    WHERE user_id = p_user_id
      AND mission_id IN (SELECT id FROM public.missions WHERE type = 'weekly')
      AND assigned_date < date_trunc('week', CURRENT_DATE)::DATE;

    -- ===== 3. 오늘의 일일 미션 할당 (없으면 5개 랜덤 할당) =====
    IF NOT EXISTS (
        SELECT 1 FROM public.user_missions um
        JOIN public.missions m ON um.mission_id = m.id
        WHERE um.user_id = p_user_id AND m.type = 'daily' AND um.assigned_date = CURRENT_DATE
    ) THEN
        INSERT INTO public.user_missions (user_id, mission_id, assigned_date)
        SELECT p_user_id, id, CURRENT_DATE
        FROM public.missions
        WHERE type = 'daily'
        ORDER BY random()
        LIMIT 5;
    END IF;

    -- ===== 4. 이번 주 주간 미션 할당 (없으면 5개 랜덤 할당) =====
    IF NOT EXISTS (
        SELECT 1 FROM public.user_missions um
        JOIN public.missions m ON um.mission_id = m.id
        WHERE um.user_id = p_user_id AND m.type = 'weekly' AND um.assigned_date = date_trunc('week', CURRENT_DATE)::DATE
    ) THEN
        INSERT INTO public.user_missions (user_id, mission_id, assigned_date)
        SELECT p_user_id, id, date_trunc('week', CURRENT_DATE)::DATE
        FROM public.missions
        WHERE type = 'weekly'
        ORDER BY random()
        LIMIT 5;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
