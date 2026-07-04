
-- 007_stamp_system.sql
-- 스탬프 시스템 (미션, 업적, 인벤토리) 마이그레이션

-- 1. 유저 인벤토리 (치장 아이템)
CREATE TABLE IF NOT EXISTS public.user_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'skin', 'frame', 'trail', 'title'
    item_code VARCHAR(100) NOT NULL,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_type, item_code)
);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own inventory" ON public.user_inventory FOR SELECT USING (auth.uid() = user_id);

-- 2. 미션 마스터 테이블
CREATE TABLE IF NOT EXISTS public.missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'achievement', 'hidden'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    goal_amount INT NOT NULL,
    reward_chips BIGINT DEFAULT 0,
    reward_item_type VARCHAR(50),
    reward_item_code VARCHAR(100),
    condition_type VARCHAR(50) NOT NULL -- 'login', 'play_single', 'play_multi', 'jump', 'boost', 'portal', etc.
);

-- 3. 유저 일일/주간 미션 테이블
CREATE TABLE IF NOT EXISTS public.user_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
    progress INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    is_collected BOOLEAN DEFAULT FALSE,
    assigned_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, mission_id, assigned_date)
);

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own missions" ON public.user_missions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own missions" ON public.user_missions FOR UPDATE USING (auth.uid() = user_id);

-- 4. 유저 업적 테이블 (누적)
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
    progress INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    is_collected BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, mission_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own achievements" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own achievements" ON public.user_achievements FOR UPDATE USING (auth.uid() = user_id);

-- 미션 데이터 삽입
INSERT INTO public.missions (type, title, description, goal_amount, reward_chips, condition_type, reward_item_type, reward_item_code) VALUES
('daily', '출석 체크', '게임 로그인하기', 1, 30, 'login', NULL, NULL),
('daily', '워밍업', '싱글 플레이 1회 완료하기', 1, 50, 'play_single', NULL, NULL),
('daily', '경쟁의 시작', '멀티 플레이 1회 참여하기', 1, 50, 'play_multi', NULL, NULL),
('daily', '아이쇼핑', '상점 1회 방문하기', 1, 10, 'visit_shop', NULL, NULL),
('daily', '창작의 고통', '맵 에디터 1회 열기', 1, 20, 'open_editor', NULL, NULL),
('daily', '탐험가', '다른 유저의 맵 1회 플레이하기', 1, 50, 'play_custom', NULL, NULL),
('daily', '거울 보기', '내 프로필 1회 확인하기', 1, 10, 'view_profile', NULL, NULL),
('daily', '단골 손님', 'VVIP 라운지 1회 확인하기', 1, 10, 'visit_vvip', NULL, NULL),
('daily', '가속 페달', '부스트 5회 사용하기', 5, 40, 'boost', NULL, NULL),
('daily', '점핑 잭', '점프 10회 하기', 10, 30, 'jump', NULL, NULL),
('daily', '아얏!', '벽에 5회 부딪히기', 5, 30, 'hit_wall', NULL, NULL),
('daily', '러닝맨', '총 이동 거리 1,000 채우기', 1000, 50, 'distance', NULL, NULL),
('daily', '안전 제일', '체크포인트 3회 통과하기', 3, 40, 'checkpoint', NULL, NULL),
('daily', '타임어택', '플레이 타임 10분 달성하기', 600, 50, 'play_time', NULL, NULL),
('daily', '인싸력', '멀티 플레이에서 이모티콘 1회 사용', 1, 20, 'emote', NULL, NULL),
('daily', '인맥 관리', '친구 목록 1회 확인하기', 1, 10, 'view_friends', NULL, NULL),
('daily', '차원 이동', '포털 1회 타기', 1, 30, 'portal', NULL, NULL),
('daily', '따끔', '함정에 1회 피격당하기', 1, 20, 'trap', NULL, NULL),
('daily', '바람을 타고', '송풍기 1회 타기', 1, 30, 'fan', NULL, NULL),
('daily', '끌림', '자석 작동 1회', 1, 30, 'magnet', NULL, NULL),
('daily', '오늘의 주인공', '멀티 플레이 1승 달성', 1, 100, 'win', NULL, NULL),
('daily', '포디움', '멀티 플레이 3위 이내 완주', 1, 70, 'top3', NULL, NULL),
('daily', '자유 낙하', '낙사 1회', 1, 20, 'fall', NULL, NULL),
('daily', '칭찬해', '좋아요 1회 누르기', 1, 20, 'like', NULL, NULL),
('daily', '수다쟁이', '채팅 1회 입력', 1, 10, 'chat', NULL, NULL),
('daily', '설계자', '맵 1회 저장', 1, 30, 'save_map', NULL, NULL),
('daily', '풀 액셀', '최고 속도 도달', 1, 40, 'max_speed', NULL, NULL),
('daily', '신속 배달', '5분 안 완주', 1, 50, 'finish_under_5m', NULL, NULL),
('daily', '연속 출석', '연속 로그인 2일', 2, 50, 'consecutive_login', NULL, NULL),
('daily', '단장하기', '스킨 변경 1회', 1, 20, 'change_skin', NULL, NULL),
('weekly', '성실한 일꾼', '일일 미션 15회 완료', 15, 500, 'daily_clear', NULL, NULL),
('weekly', '배틀 마스터', '멀티 플레이 30회 참여', 30, 400, 'play_multi', NULL, NULL),
('weekly', '승부사', '멀티 5승 달성', 5, 600, 'win', NULL, NULL),
('weekly', '마라토너', '거리 50,000', 50000, 400, 'distance', NULL, NULL),
('weekly', '부스트 중독', '부스트 100회', 100, 300, 'boost', NULL, NULL),
('weekly', '테스터', '다른 유저 맵 20회', 20, 400, 'play_custom', NULL, NULL),
('weekly', '죽돌이', '플레이 타임 5시간', 18000, 500, 'play_time', NULL, NULL),
('weekly', '체크포인트 수집', '체크포인트 100회', 100, 350, 'checkpoint', NULL, NULL),
('weekly', '메달리스트', '탑3 10회', 10, 450, 'top3', NULL, NULL),
('weekly', '포탈 매니아', '포탈 50회', 50, 300, 'portal', NULL, NULL),
('weekly', '신입 건축가', '맵 퍼블리싱 1회', 1, 600, 'publish_map', NULL, NULL),
('weekly', '인기 맵', '내 맵 좋아요 5회', 5, 500, 'receive_like', NULL, NULL),
('weekly', '플렉스', '상점 구매 1회', 1, 300, 'buy_item', NULL, NULL),
('weekly', '수익 창출', '누적 5,000 칩', 5000, 400, 'earn_chips', NULL, NULL),
('weekly', '근태 우수', '연속 로그인 5일', 5, 300, 'consecutive_login', NULL, NULL),
('weekly', '선플러', '좋아요 10회', 10, 200, 'like', NULL, NULL),
('weekly', '방방이', '점프 500회', 500, 300, 'jump', NULL, NULL),
('weekly', '네트워킹', '친구 1명 추가', 1, 200, 'add_friend', NULL, NULL),
('weekly', '바람막이', '송풍기 50회', 50, 300, 'fan', NULL, NULL),
('weekly', '불시착', '낙사 30회', 30, 200, 'fall', NULL, NULL),
('weekly', '맷집왕', '함정 피격 50회', 50, 250, 'trap', NULL, NULL),
('weekly', '완주자', '맵 완주 20회', 20, 400, 'finish_map', NULL, NULL),
('weekly', '자유로운 영혼', '자유형 블록 맵 5회', 5, 300, 'play_free_block', NULL, NULL),
('weekly', '퍼펙트 위크', '일일 올클리어 3회', 3, 600, 'daily_all_clear', NULL, NULL),
('weekly', '사진 판독', '1초 이내 차이 완주', 1, 400, 'close_finish', NULL, NULL),
('weekly', '표정 부자', '이모티콘 50회', 50, 200, 'emote', NULL, NULL),
('weekly', '핵인싸', '채팅 50회', 50, 200, 'chat', NULL, NULL),
('weekly', '새 마음 새 뜻', '프로필 사진 변경', 1, 100, 'change_pfp', NULL, NULL),
('weekly', '불굴의 의지', '10분 이상 걸려 완주', 1, 350, 'long_finish', NULL, NULL),
('weekly', '휴식', 'VVIP 5분 머무르기', 300, 200, 'vvip_stay', NULL, NULL),
('achievement', '첫 걸음', '누적 10판', 10, 200, 'play_any', NULL, NULL),
('achievement', '익숙한 발걸음', '누적 100판', 100, 1000, 'play_any', NULL, NULL),
('achievement', '롤링 마스터', '누적 1000판', 1000, 5000, 'play_any', 'title', 'master'),
('achievement', '승리의 맛', '첫 1승', 1, 300, 'win', NULL, NULL),
('achievement', '도박사', '누적 백만 칩', 1000000, 10000, 'earn_chips', 'skin', 'gold'),
('achievement', '지구 한 바퀴', '이동거리 1,000,000', 1000000, 5000, 'distance', 'trail', 'globe'),
('achievement', '폴짝폴짝', '점프 10,000회', 10000, 1000, 'jump', NULL, NULL),
('achievement', '포탈 여행자', '포탈 1,000회', 1000, 1500, 'portal', NULL, NULL),
('achievement', '꼬마 건축가', '맵 5개 퍼블리싱', 5, 2000, 'publish_map', NULL, NULL),
('achievement', '마스터 빌더', '좋아요 1,000개', 1000, 20000, 'receive_like', 'title', 'architect'),
('achievement', '개근상 (금)', '로그인 365일', 365, 50000, 'login', 'skin', 'anniversary1'),
('achievement', '최고의 경지', '크롬 랭크 달성', 1, 20000, 'reach_chrome', 'trail', 'vvip'),
('achievement', '고인물', '상위 1% 기록', 1, 5000, 'top_1_percent', NULL, NULL),
('achievement', '올라운더', '10가지 스킨 승리', 10, 3000, 'win_diff_skins', NULL, NULL),
('achievement', '구사일생', '체력 1% 완주', 1, 2000, 'finish_1hp', NULL, NULL),
('hidden', '비밀번호가 뭔가요?', '비밀번호 3회 변경', 3, 777, 'change_pw', 'title', 'amnesia'),
('hidden', '럭키 세븐', '정확히 7777칩', 1, 7777, 'exact_7777', NULL, NULL),
('hidden', '평화주의자', '부스트 없이 완주', 1, 2000, 'no_boost_finish', 'skin', 'turtle'),
('hidden', '텅장', '칩 0개 만들기', 1, 100, 'zero_chips', NULL, NULL),
('hidden', '마우스 압수', '키보드만으로 완주', 1, 2000, 'keyboard_only', NULL, NULL);


-- 5. RPC Functions
-- 5.1 일일/주간 미션 무작위 할당
CREATE OR REPLACE FUNCTION public.assign_random_missions(p_user_id UUID)
RETURNS void AS $$\
BEGIN
    -- 오래된 일일 미션 정리 (오늘 이전 것 삭제)
    DELETE FROM public.user_missions
    WHERE user_id = p_user_id
      AND mission_id IN (SELECT id FROM public.missions WHERE type = 'daily')
      AND assigned_date < CURRENT_DATE;

    -- 오래된 주간 미션 정리 (이번 주 이전 것 삭제)
    DELETE FROM public.user_missions
    WHERE user_id = p_user_id
      AND mission_id IN (SELECT id FROM public.missions WHERE type = 'weekly')
      AND assigned_date < date_trunc('week', CURRENT_DATE)::DATE;

    -- 일일 미션: 오늘 할당된 것이 없으면 5개 랜덤 할당
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

    -- 주간 미션: 이번 주 할당된 것이 없으면 5개 랜덤 할당
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

-- 5.2 이벤트 일괄 처리(진행도 업데이트)
CREATE OR REPLACE FUNCTION public.update_mission_progress(p_user_id UUID, p_events JSONB)
RETURNS void AS $$\
DECLARE
    event_key TEXT;
    event_val INT;
BEGIN
    FOR event_key, event_val IN SELECT * FROM jsonb_each_text(p_events)
    LOOP
        -- 일일/주간 미션 업데이트
        UPDATE public.user_missions um
        SET progress = LEAST(um.progress + event_val::INT, m.goal_amount),
            completed = CASE WHEN um.progress + event_val::INT >= m.goal_amount THEN TRUE ELSE FALSE END
        FROM public.missions m
        WHERE um.mission_id = m.id
          AND um.user_id = p_user_id
          AND m.condition_type = event_key
          AND um.completed = FALSE
          AND um.assigned_date = CASE WHEN m.type = 'daily' THEN CURRENT_DATE ELSE date_trunc('week', CURRENT_DATE)::DATE END;

        -- 업적 업데이트 (누적)
        -- user_achievements에 아직 row가 없다면 생성
        INSERT INTO public.user_achievements (user_id, mission_id, progress)
        SELECT p_user_id, m.id, 0
        FROM public.missions m
        WHERE m.type IN ('achievement', 'hidden') AND m.condition_type = event_key
        ON CONFLICT (user_id, mission_id) DO NOTHING;

        UPDATE public.user_achievements ua
        SET progress = LEAST(ua.progress + event_val::INT, m.goal_amount),
            completed = CASE WHEN ua.progress + event_val::INT >= m.goal_amount THEN TRUE ELSE FALSE END,
            updated_at = NOW()
        FROM public.missions m
        WHERE ua.mission_id = m.id
          AND ua.user_id = p_user_id
          AND m.condition_type = event_key
          AND ua.completed = FALSE;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.3 보상 수령 함수
CREATE OR REPLACE FUNCTION public.claim_mission_reward(p_user_id UUID, p_table_type TEXT, p_record_id UUID)
RETURNS JSONB AS $$\
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

        UPDATE public.user_missions SET is_collected = TRUE WHERE id = p_record_id;

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

        UPDATE public.user_achievements SET is_collected = TRUE WHERE id = p_record_id;
    ELSE
        RAISE EXCEPTION 'Unknown table type';
    END IF;

    -- 칩 지급
    IF v_reward_chips > 0 THEN
        PERFORM public.add_chips(p_user_id, v_reward_chips, 'Mission/Achievement Reward');
    END IF;

    -- 아이템 지급
    IF v_reward_item_type IS NOT NULL AND v_reward_item_code IS NOT NULL THEN
        INSERT INTO public.user_inventory (user_id, item_type, item_code)
        VALUES (p_user_id, v_reward_item_type, v_reward_item_code)
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object('chips', v_reward_chips, 'itemType', v_reward_item_type, 'itemCode', v_reward_item_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
