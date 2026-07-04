const fs = require('fs');
const path = require('path');

const schema = `
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
`;

const dailyMissions = [
  // 기본 활동 (쉬움, 80~100칩)
  { t: "출석 체크", d: "게임 로그인하기", g: 1, c: 100, cond: "login" },
  { t: "아이쇼핑", d: "상점 1회 방문하기", g: 1, c: 80, cond: "visit_shop" },
  { t: "창작의 고통", d: "맵 에디터 1회 열기", g: 1, c: 100, cond: "open_editor" },
  { t: "자유 낙하", d: "낙사 1회", g: 1, c: 80, cond: "fall" },
  { t: "칭찬해", d: "좋아요 1회 누르기", g: 1, c: 80, cond: "like" },
  { t: "수다쟁이", d: "채팅 1회 입력", g: 1, c: 80, cond: "chat" },
  { t: "인싸력", d: "이모티콘 1회 사용", g: 1, c: 80, cond: "emote" },
  { t: "따끔", d: "함정에 1회 피격당하기", g: 1, c: 80, cond: "trap" },
  { t: "차원 이동", d: "포털 1회 타기", g: 1, c: 100, cond: "portal" },
  { t: "바람을 타고", d: "송풍기 1회 타기", g: 1, c: 100, cond: "fan" },
  // 플레이 활동 (보통, 120~200칩)
  { t: "워밍업", d: "싱글 플레이 1회 완료하기", g: 1, c: 150, cond: "play_single" },
  { t: "경쟁의 시작", d: "멀티 플레이 1회 참여하기", g: 1, c: 150, cond: "play_multi" },
  { t: "탐험가", d: "다른 유저의 맵 1회 플레이하기", g: 1, c: 150, cond: "play_custom" },
  { t: "설계자", d: "맵 1회 저장", g: 1, c: 120, cond: "save_map" },
  { t: "가속 페달", d: "부스트 3회 사용하기", g: 3, c: 150, cond: "boost" },
  { t: "점핑 잭", d: "점프 5회 하기", g: 5, c: 120, cond: "jump" },
  { t: "아얏!", d: "벽에 3회 부딪히기", g: 3, c: 100, cond: "hit_wall" },
  { t: "안전 제일", d: "체크포인트 2회 통과하기", g: 2, c: 120, cond: "checkpoint" },
  { t: "스피드 러너", d: "맵 완주 3회", g: 3, c: 200, cond: "finish_map" },
  // 도전 활동 (어려움, 200칩 이상)
  { t: "러닝맨", d: "총 이동 거리 500 채우기", g: 500, c: 200, cond: "distance" },
  { t: "타임어택", d: "플레이 타임 5분 달성하기", g: 300, c: 200, cond: "play_time" },
  { t: "포디움", d: "멀티 플레이 3위 이내 완주", g: 1, c: 200, cond: "top3" },
  { t: "오늘의 주인공", d: "멀티 플레이 1승 달성", g: 1, c: 300, cond: "win" },
  { t: "해트트릭", d: "멀티 플레이 3승 달성", g: 3, c: 500, cond: "win" },
  { t: "범퍼카", d: "벽에 10회 부딪히기", g: 10, c: 200, cond: "hit_wall" },
];

const weeklyMissions = [
  // 보통 난이도 (500~800칩)
  { t: "선플러", d: "좋아요 5회 누르기", g: 5, c: 500, cond: "like" },
  { t: "불시착", d: "낙사 15회", g: 15, c: 500, cond: "fall" },
  { t: "핵인싸", d: "채팅 20회 입력", g: 20, c: 500, cond: "chat" },
  { t: "플렉스", d: "상점 구매 1회", g: 1, c: 500, cond: "buy_item" },
  { t: "표정 부자", d: "이모티콘 20회 사용", g: 20, c: 600, cond: "emote" },
  { t: "맷집왕", d: "함정 피격 25회", g: 25, c: 600, cond: "trap" },
  { t: "방방이", d: "점프 200회", g: 200, c: 700, cond: "jump" },
  { t: "포탈 매니아", d: "포탈 30회 타기", g: 30, c: 700, cond: "portal" },
  { t: "바람막이", d: "송풍기 20회 타기", g: 20, c: 700, cond: "fan" },
  { t: "부스트 중독", d: "부스트 50회 사용", g: 50, c: 800, cond: "boost" },
  { t: "맵 건축가", d: "맵 5회 저장", g: 5, c: 800, cond: "save_map" },
  { t: "체크포인트 수집", d: "체크포인트 50회 통과", g: 50, c: 800, cond: "checkpoint" },
  // 어려운 난이도 (1,000칩 이상)
  { t: "배틀 마스터", d: "멀티 플레이 15회 참여", g: 15, c: 1000, cond: "play_multi" },
  { t: "테스터", d: "다른 유저 맵 10회 플레이", g: 10, c: 1000, cond: "play_custom" },
  { t: "마라토너", d: "총 이동 거리 20,000", g: 20000, c: 1000, cond: "distance" },
  { t: "완주자", d: "맵 완주 10회", g: 10, c: 1000, cond: "finish_map" },
  { t: "죽돌이", d: "플레이 타임 2시간", g: 7200, c: 1200, cond: "play_time" },
  { t: "메달리스트", d: "탑3 5회 달성", g: 5, c: 1200, cond: "top3" },
  { t: "승부사", d: "멀티 3승 달성", g: 3, c: 1500, cond: "win" },
  { t: "신입 건축가", d: "맵 퍼블리싱 1회", g: 1, c: 1500, cond: "publish_map" },
];

const achievements = [
  // 초반 업적 (쉬움)
  { t: "첫 걸음", d: "누적 5판 플레이", g: 5, c: 500, cond: "play_any" },
  { t: "승리의 맛", d: "첫 1승 달성", g: 1, c: 1000, cond: "win" },
  // 중반 업적 (보통)
  { t: "익숙한 발걸음", d: "누적 50판 플레이", g: 50, c: 3000, cond: "play_any" },
  { t: "폴짝폴짝", d: "점프 3,000회 달성", g: 3000, c: 5000, cond: "jump" },
  { t: "포탈 여행자", d: "포탈 300회 이용", g: 300, c: 5000, cond: "portal" },
  { t: "꼬마 건축가", d: "맵 3개 퍼블리싱", g: 3, c: 5000, cond: "publish_map" },
  { t: "구사일생", d: "체력 1%로 완주", g: 1, c: 5000, cond: "finish_1hp" },
  { t: "콜렉터", d: "상점 아이템 10개 구매", g: 10, c: 5000, cond: "buy_item" },
  { t: "소셜 나비", d: "채팅 500회 달성", g: 500, c: 5000, cond: "chat" },
  { t: "불사신", d: "낙사 1,000회", g: 1000, c: 5000, cond: "fall", rt: "skin", rc: "zombie" },
  // 후반 업적 (어려움)
  { t: "올라운더", d: "5가지 스킨으로 승리", g: 5, c: 8000, cond: "win_diff_skins" },
  { t: "부스터 매니아", d: "부스트 5,000회", g: 5000, c: 8000, cond: "boost" },
  { t: "롤링 마스터", d: "누적 300판 플레이", g: 300, c: 10000, cond: "play_any", rt: "title", rc: "master" },
  { t: "고인물", d: "상위 1% 기록 달성", g: 1, c: 10000, cond: "top_1_percent" },
  { t: "이벤트 헌터", d: "맵 완주 500회", g: 500, c: 15000, cond: "finish_map", rt: "title", rc: "hunter" },
  { t: "지구 한 바퀴", d: "이동거리 200,000", g: 200000, c: 15000, cond: "distance", rt: "trail", rc: "globe" },
  // 최종 업적 (매우 어려움)
  { t: "도박사", d: "누적 100,000칩 획득", g: 100000, c: 20000, cond: "earn_chips", rt: "skin", rc: "gold" },
  { t: "마스터 빌더", d: "좋아요 100개 받기", g: 100, c: 30000, cond: "receive_like", rt: "title", rc: "architect" },
  { t: "최고의 경지", d: "크롬 랭크 달성", g: 1, c: 30000, cond: "reach_chrome", rt: "trail", rc: "vvip" },
  { t: "개근상 (금)", d: "로그인 100일", g: 100, c: 50000, cond: "login", rt: "skin", rc: "anniversary1" },
];

const hiddenAchievements = [
  { t: "비밀번호가 뭔가요?", d: "비밀번호 3회 변경", g: 3, c: 2000, cond: "change_pw", rt: "title", rc: "amnesia" },
  { t: "럭키 세븐", d: "정확히 7777칩 보유", g: 1, c: 7777, cond: "exact_7777" },
  { t: "평화주의자", d: "부스트 없이 완주", g: 1, c: 5000, cond: "no_boost_finish", rt: "skin", rc: "turtle" },
  { t: "텅장", d: "칩 0개 만들기", g: 1, c: 1000, cond: "zero_chips" },
  { t: "마우스 압수", d: "키보드만으로 완주", g: 1, c: 5000, cond: "keyboard_only" }
];

let inserts = 'INSERT INTO public.missions (type, title, description, goal_amount, reward_chips, condition_type, reward_item_type, reward_item_code) VALUES\n';

const rows = [];
const addRows = (list, type) => {
  for (const item of list) {
    const rt = item.rt ? `'${item.rt}'` : 'NULL';
    const rc = item.rc ? `'${item.rc}'` : 'NULL';
    rows.push(`('${type}', '${item.t}', '${item.d}', ${item.g}, ${item.c}, '${item.cond}', ${rt}, ${rc})`);
  }
};

addRows(dailyMissions, 'daily');
addRows(weeklyMissions, 'weekly');
addRows(achievements, 'achievement');
addRows(hiddenAchievements, 'hidden');

inserts += rows.join(',\n') + ';\n\n';

const rpcAndCron = `
-- 5. RPC Functions
-- 5.1 일일/주간 미션 무작위 할당
CREATE OR REPLACE FUNCTION public.assign_random_missions(p_user_id UUID)
RETURNS void AS $$\\
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
RETURNS void AS $$\\
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
RETURNS JSONB AS $$\\
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
`;

fs.writeFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '007_stamp_system.sql'), schema + inserts + rpcAndCron);
console.log('007_stamp_system.sql created successfully.');
