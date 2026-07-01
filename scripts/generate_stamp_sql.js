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
  { t: "출석 체크", d: "게임 로그인하기", g: 1, c: 30, cond: "login" },
  { t: "워밍업", d: "싱글 플레이 1회 완료하기", g: 1, c: 50, cond: "play_single" },
  { t: "경쟁의 시작", d: "멀티 플레이 1회 참여하기", g: 1, c: 50, cond: "play_multi" },
  { t: "아이쇼핑", d: "상점 1회 방문하기", g: 1, c: 10, cond: "visit_shop" },
  { t: "창작의 고통", d: "맵 에디터 1회 열기", g: 1, c: 20, cond: "open_editor" },
  { t: "탐험가", d: "다른 유저의 맵 1회 플레이하기", g: 1, c: 50, cond: "play_custom" },
  { t: "거울 보기", d: "내 프로필 1회 확인하기", g: 1, c: 10, cond: "view_profile" },
  { t: "단골 손님", d: "VVIP 라운지 1회 확인하기", g: 1, c: 10, cond: "visit_vvip" },
  { t: "가속 페달", d: "부스트 5회 사용하기", g: 5, c: 40, cond: "boost" },
  { t: "점핑 잭", d: "점프 10회 하기", g: 10, c: 30, cond: "jump" },
  { t: "아얏!", d: "벽에 5회 부딪히기", g: 5, c: 30, cond: "hit_wall" },
  { t: "러닝맨", d: "총 이동 거리 1,000 채우기", g: 1000, c: 50, cond: "distance" },
  { t: "안전 제일", d: "체크포인트 3회 통과하기", g: 3, c: 40, cond: "checkpoint" },
  { t: "타임어택", d: "플레이 타임 10분 달성하기", g: 600, c: 50, cond: "play_time" },
  { t: "인싸력", d: "멀티 플레이에서 이모티콘 1회 사용", g: 1, c: 20, cond: "emote" },
  { t: "인맥 관리", d: "친구 목록 1회 확인하기", g: 1, c: 10, cond: "view_friends" },
  { t: "차원 이동", d: "포털 1회 타기", g: 1, c: 30, cond: "portal" },
  { t: "따끔", d: "함정에 1회 피격당하기", g: 1, c: 20, cond: "trap" },
  { t: "바람을 타고", d: "송풍기 1회 타기", g: 1, c: 30, cond: "fan" },
  { t: "끌림", d: "자석 작동 1회", g: 1, c: 30, cond: "magnet" },
  { t: "오늘의 주인공", d: "멀티 플레이 1승 달성", g: 1, c: 100, cond: "win" },
  { t: "포디움", d: "멀티 플레이 3위 이내 완주", g: 1, c: 70, cond: "top3" },
  { t: "자유 낙하", d: "낙사 1회", g: 1, c: 20, cond: "fall" },
  { t: "칭찬해", d: "좋아요 1회 누르기", g: 1, c: 20, cond: "like" },
  { t: "수다쟁이", d: "채팅 1회 입력", g: 1, c: 10, cond: "chat" },
  { t: "설계자", d: "맵 1회 저장", g: 1, c: 30, cond: "save_map" },
  { t: "풀 액셀", d: "최고 속도 도달", g: 1, c: 40, cond: "max_speed" },
  { t: "신속 배달", d: "5분 안 완주", g: 1, c: 50, cond: "finish_under_5m" },
  { t: "연속 출석", d: "연속 로그인 2일", g: 2, c: 50, cond: "consecutive_login" },
  { t: "단장하기", d: "스킨 변경 1회", g: 1, c: 20, cond: "change_skin" },
];

const weeklyMissions = [
  { t: "성실한 일꾼", d: "일일 미션 15회 완료", g: 15, c: 500, cond: "daily_clear" },
  { t: "배틀 마스터", d: "멀티 플레이 30회 참여", g: 30, c: 400, cond: "play_multi" },
  { t: "승부사", d: "멀티 5승 달성", g: 5, c: 600, cond: "win" },
  { t: "마라토너", d: "거리 50,000", g: 50000, c: 400, cond: "distance" },
  { t: "부스트 중독", d: "부스트 100회", g: 100, c: 300, cond: "boost" },
  { t: "테스터", d: "다른 유저 맵 20회", g: 20, c: 400, cond: "play_custom" },
  { t: "죽돌이", d: "플레이 타임 5시간", g: 18000, c: 500, cond: "play_time" },
  { t: "체크포인트 수집", d: "체크포인트 100회", g: 100, c: 350, cond: "checkpoint" },
  { t: "메달리스트", d: "탑3 10회", g: 10, c: 450, cond: "top3" },
  { t: "포탈 매니아", d: "포탈 50회", g: 50, c: 300, cond: "portal" },
  { t: "신입 건축가", d: "맵 퍼블리싱 1회", g: 1, c: 600, cond: "publish_map" },
  { t: "인기 맵", d: "내 맵 좋아요 5회", g: 5, c: 500, cond: "receive_like" },
  { t: "플렉스", d: "상점 구매 1회", g: 1, c: 300, cond: "buy_item" },
  { t: "수익 창출", d: "누적 5,000 칩", g: 5000, c: 400, cond: "earn_chips" },
  { t: "근태 우수", d: "연속 로그인 5일", g: 5, c: 300, cond: "consecutive_login" },
  { t: "선플러", d: "좋아요 10회", g: 10, c: 200, cond: "like" },
  { t: "방방이", d: "점프 500회", g: 500, c: 300, cond: "jump" },
  { t: "네트워킹", d: "친구 1명 추가", g: 1, c: 200, cond: "add_friend" },
  { t: "바람막이", d: "송풍기 50회", g: 50, c: 300, cond: "fan" },
  { t: "불시착", d: "낙사 30회", g: 30, c: 200, cond: "fall" },
  { t: "맷집왕", d: "함정 피격 50회", g: 50, c: 250, cond: "trap" },
  { t: "완주자", d: "맵 완주 20회", g: 20, c: 400, cond: "finish_map" },
  { t: "자유로운 영혼", d: "자유형 블록 맵 5회", g: 5, c: 300, cond: "play_free_block" },
  { t: "퍼펙트 위크", d: "일일 올클리어 3회", g: 3, c: 600, cond: "daily_all_clear" },
  { t: "사진 판독", d: "1초 이내 차이 완주", g: 1, c: 400, cond: "close_finish" },
  { t: "표정 부자", d: "이모티콘 50회", g: 50, c: 200, cond: "emote" },
  { t: "핵인싸", d: "채팅 50회", g: 50, c: 200, cond: "chat" },
  { t: "새 마음 새 뜻", d: "프로필 사진 변경", g: 1, c: 100, cond: "change_pfp" },
  { t: "불굴의 의지", d: "10분 이상 걸려 완주", g: 1, c: 350, cond: "long_finish" },
  { t: "휴식", d: "VVIP 5분 머무르기", g: 300, c: 200, cond: "vvip_stay" }
];

const achievements = [
  { t: "첫 걸음", d: "누적 10판", g: 10, c: 200, cond: "play_any" },
  { t: "익숙한 발걸음", d: "누적 100판", g: 100, c: 1000, cond: "play_any" },
  { t: "롤링 마스터", d: "누적 1000판", g: 1000, c: 5000, cond: "play_any", rt: "title", rc: "master" },
  { t: "승리의 맛", d: "첫 1승", g: 1, c: 300, cond: "win" },
  { t: "도박사", d: "누적 백만 칩", g: 1000000, c: 10000, cond: "earn_chips", rt: "skin", rc: "gold" },
  { t: "지구 한 바퀴", d: "이동거리 1,000,000", g: 1000000, c: 5000, cond: "distance", rt: "trail", rc: "globe" },
  { t: "폴짝폴짝", d: "점프 10,000회", g: 10000, c: 1000, cond: "jump" },
  { t: "포탈 여행자", d: "포탈 1,000회", g: 1000, c: 1500, cond: "portal" },
  { t: "꼬마 건축가", d: "맵 5개 퍼블리싱", g: 5, c: 2000, cond: "publish_map" },
  { t: "마스터 빌더", d: "좋아요 1,000개", g: 1000, c: 20000, cond: "receive_like", rt: "title", rc: "architect" },
  { t: "개근상 (금)", d: "로그인 365일", g: 365, c: 50000, cond: "login", rt: "skin", rc: "anniversary1" },
  { t: "최고의 경지", d: "크롬 랭크 달성", g: 1, c: 20000, cond: "reach_chrome", rt: "trail", rc: "vvip" },
  { t: "고인물", d: "상위 1% 기록", g: 1, c: 5000, cond: "top_1_percent" },
  { t: "올라운더", d: "10가지 스킨 승리", g: 10, c: 3000, cond: "win_diff_skins" },
  { t: "구사일생", d: "체력 1% 완주", g: 1, c: 2000, cond: "finish_1hp" }
];

const hiddenAchievements = [
  { t: "비밀번호가 뭔가요?", d: "비밀번호 3회 변경", g: 3, c: 777, cond: "change_pw", rt: "title", rc: "amnesia" },
  { t: "럭키 세븐", d: "정확히 7777칩", g: 1, c: 7777, cond: "exact_7777" },
  { t: "평화주의자", d: "부스트 없이 완주", g: 1, c: 2000, cond: "no_boost_finish", rt: "skin", rc: "turtle" },
  { t: "텅장", d: "칩 0개 만들기", g: 1, c: 100, cond: "zero_chips" },
  { t: "마우스 압수", d: "키보드만으로 완주", g: 1, c: 2000, cond: "keyboard_only" }
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
    -- 기존 할당된 오늘/이번주 미션 확인
    -- 일일 미션
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
        LIMIT 3;
    END IF;

    -- 주간 미션 (이번주 월요일을 기준으로 체크)
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
        LIMIT 3;
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
