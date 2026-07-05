-- 012_mission_timestamps.sql
-- 미션/업적 진행 정렬을 위한 타임스탬프 필드 추가

-- 1. user_missions 테이블에 타임스탬프 추가
ALTER TABLE public.user_missions
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rewarded_at TIMESTAMP WITH TIME ZONE;

-- 2. user_achievements 테이블에 타임스탬프 추가
ALTER TABLE public.user_achievements
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rewarded_at TIMESTAMP WITH TIME ZONE;


-- 3. update_mission_progress 함수 재정의 (completed_at 기록 추가)
CREATE OR REPLACE FUNCTION public.update_mission_progress(p_user_id UUID, p_events JSONB)
RETURNS void AS $$
DECLARE
    event_key TEXT;
    event_val INT;
BEGIN
    FOR event_key, event_val IN SELECT * FROM jsonb_each_text(p_events)
    LOOP
        -- 일일/주간 미션 업데이트
        UPDATE public.user_missions um
        SET progress = LEAST(um.progress + event_val::INT, m.goal_amount),
            completed = CASE WHEN um.progress + event_val::INT >= m.goal_amount THEN TRUE ELSE FALSE END,
            completed_at = CASE WHEN um.progress + event_val::INT >= m.goal_amount AND um.completed = FALSE THEN NOW() ELSE um.completed_at END
        FROM public.missions m
        WHERE um.mission_id = m.id
          AND um.user_id = p_user_id
          AND m.condition_type = event_key
          AND um.completed = FALSE
          AND um.assigned_date = CASE WHEN m.type = 'daily' THEN CURRENT_DATE ELSE date_trunc('week', CURRENT_DATE)::DATE END;

        -- 업적 업데이트 (누적)
        INSERT INTO public.user_achievements (user_id, mission_id, progress)
        SELECT p_user_id, m.id, 0
        FROM public.missions m
        WHERE m.type IN ('achievement', 'hidden') AND m.condition_type = event_key
        ON CONFLICT (user_id, mission_id) DO NOTHING;

        UPDATE public.user_achievements ua
        SET progress = LEAST(ua.progress + event_val::INT, m.goal_amount),
            completed = CASE WHEN ua.progress + event_val::INT >= m.goal_amount THEN TRUE ELSE FALSE END,
            completed_at = CASE WHEN ua.progress + event_val::INT >= m.goal_amount AND ua.completed = FALSE THEN NOW() ELSE ua.completed_at END,
            updated_at = NOW()
        FROM public.missions m
        WHERE ua.mission_id = m.id
          AND ua.user_id = p_user_id
          AND m.condition_type = event_key
          AND ua.completed = FALSE;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. claim_mission_reward 함수 재정의 (rewarded_at 기록 추가)
CREATE OR REPLACE FUNCTION public.claim_mission_reward(p_user_id UUID, p_table_type TEXT, p_record_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_mission_id UUID;
    v_reward_chips BIGINT;
    v_reward_item_type TEXT;
    v_reward_item_code TEXT;
    v_completed BOOLEAN;
    v_is_collected BOOLEAN;
BEGIN
    IF p_table_type = 'mission' THEN
        SELECT um.mission_id, um.completed, um.is_collected, m.reward_chips, m.reward_item_type, m.reward_item_code
        INTO v_mission_id, v_completed, v_is_collected, v_reward_chips, v_reward_item_type, v_reward_item_code
        FROM public.user_missions um
        JOIN public.missions m ON um.mission_id = m.id
        WHERE um.id = p_record_id AND um.user_id = p_user_id
        FOR UPDATE OF um;

        IF NOT FOUND OR NOT v_completed OR v_is_collected THEN
            RAISE EXCEPTION 'Invalid or already collected mission';
        END IF;

        UPDATE public.user_missions 
        SET is_collected = TRUE,
            rewarded_at = NOW()
        WHERE id = p_record_id;

    ELSIF p_table_type = 'achievement' THEN
        SELECT ua.mission_id, ua.completed, ua.is_collected, m.reward_chips, m.reward_item_type, m.reward_item_code
        INTO v_mission_id, v_completed, v_is_collected, v_reward_chips, v_reward_item_type, v_reward_item_code
        FROM public.user_achievements ua
        JOIN public.missions m ON ua.mission_id = m.id
        WHERE ua.id = p_record_id AND ua.user_id = p_user_id
        FOR UPDATE OF ua;

        IF NOT FOUND OR NOT v_completed OR v_is_collected THEN
            RAISE EXCEPTION 'Invalid or already collected achievement';
        END IF;

        UPDATE public.user_achievements 
        SET is_collected = TRUE,
            rewarded_at = NOW()
        WHERE id = p_record_id;
    ELSE
        RAISE EXCEPTION 'Invalid table type';
    END IF;

    -- 유저 재화(칩) 증가
    IF v_reward_chips > 0 THEN
        UPDATE public.profiles
        SET chips = chips + v_reward_chips
        WHERE id = p_user_id;
    END IF;

    -- 아이템 지급 로직
    IF v_reward_item_type IS NOT NULL AND v_reward_item_code IS NOT NULL THEN
        INSERT INTO public.user_inventory (user_id, item_type, item_code)
        VALUES (p_user_id, v_reward_item_type, v_reward_item_code)
        ON CONFLICT (user_id, item_type, item_code) DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'chips', v_reward_chips,
        'itemType', v_reward_item_type,
        'itemCode', v_reward_item_code
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
