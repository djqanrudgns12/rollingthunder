-- 010_economy_rebalance.sql
-- 경제 시스템 전면 리밸런싱: 미션 보상 상향 + 상점 가격 인하
--
-- 변경 사항:
--   - 일일 미션: 30개 → 25개 (미구현 condition_type 삭제, 보상 3~5배 상향)
--   - 주간 미션: 30개 → 20개 (미구현 삭제, 보상 2~3배 상향, 목표 40~60% 하향)
--   - 업적: 목표 대폭 하향 + 보상 2~3배 상향 + 신규 5개 추가
--   - 히든: 보상 상향

-- =====================================================
-- Step 1: 기존 user_missions / user_achievements 정리
-- (외래 키 제약 때문에 missions 삭제 전에 먼저 정리)
-- =====================================================
DELETE FROM public.user_missions;
DELETE FROM public.user_achievements;

-- =====================================================
-- Step 2: 기존 missions 전체 삭제
-- =====================================================
DELETE FROM public.missions;

-- =====================================================
-- Step 3: 리밸런싱된 미션 데이터 삽입
-- =====================================================

-- ==================== 일일 미션 (25개) ====================
INSERT INTO public.missions (type, title, description, goal_amount, reward_chips, condition_type, reward_item_type, reward_item_code) VALUES
-- 기본 활동 (쉬움, 100칩 미만)
('daily', '출석 체크', '게임 로그인하기', 1, 100, 'login', NULL, NULL),
('daily', '아이쇼핑', '상점 1회 방문하기', 1, 80, 'visit_shop', NULL, NULL),
('daily', '창작의 고통', '맵 에디터 1회 열기', 1, 100, 'open_editor', NULL, NULL),
('daily', '자유 낙하', '낙사 1회', 1, 80, 'fall', NULL, NULL),
('daily', '칭찬해', '좋아요 1회 누르기', 1, 80, 'like', NULL, NULL),
('daily', '수다쟁이', '채팅 1회 입력', 1, 80, 'chat', NULL, NULL),
('daily', '인싸력', '이모티콘 1회 사용', 1, 80, 'emote', NULL, NULL),
('daily', '따끔', '함정에 1회 피격당하기', 1, 80, 'trap', NULL, NULL),
('daily', '차원 이동', '포털 1회 타기', 1, 100, 'portal', NULL, NULL),
('daily', '바람을 타고', '송풍기 1회 타기', 1, 100, 'fan', NULL, NULL),

-- 플레이 활동 (보통, 100~200칩)
('daily', '워밍업', '싱글 플레이 1회 완료하기', 1, 150, 'play_single', NULL, NULL),
('daily', '경쟁의 시작', '멀티 플레이 1회 참여하기', 1, 150, 'play_multi', NULL, NULL),
('daily', '탐험가', '다른 유저의 맵 1회 플레이하기', 1, 150, 'play_custom', NULL, NULL),
('daily', '설계자', '맵 1회 저장', 1, 120, 'save_map', NULL, NULL),
('daily', '가속 페달', '부스트 3회 사용하기', 3, 150, 'boost', NULL, NULL),
('daily', '점핑 잭', '점프 5회 하기', 5, 120, 'jump', NULL, NULL),
('daily', '아얏!', '벽에 3회 부딪히기', 3, 100, 'hit_wall', NULL, NULL),
('daily', '안전 제일', '체크포인트 2회 통과하기', 2, 120, 'checkpoint', NULL, NULL),
('daily', '스피드 러너', '맵 완주 3회', 3, 200, 'finish_map', NULL, NULL),

-- 도전 활동 (어려움, 200칩 이상)
('daily', '러닝맨', '총 이동 거리 500 채우기', 500, 200, 'distance', NULL, NULL),
('daily', '타임어택', '플레이 타임 5분 달성하기', 300, 200, 'play_time', NULL, NULL),
('daily', '포디움', '멀티 플레이 3위 이내 완주', 1, 200, 'top3', NULL, NULL),
('daily', '오늘의 주인공', '멀티 플레이 1승 달성', 1, 300, 'win', NULL, NULL),
('daily', '해트트릭', '멀티 플레이 3승 달성', 3, 500, 'win', NULL, NULL),
('daily', '범퍼카', '벽에 10회 부딪히기', 10, 200, 'hit_wall', NULL, NULL),

-- ==================== 주간 미션 (20개) ====================
-- 보통 난이도 (500~800칩)
('weekly', '선플러', '좋아요 5회 누르기', 5, 500, 'like', NULL, NULL),
('weekly', '불시착', '낙사 15회', 15, 500, 'fall', NULL, NULL),
('weekly', '핵인싸', '채팅 20회 입력', 20, 500, 'chat', NULL, NULL),
('weekly', '플렉스', '상점 구매 1회', 1, 500, 'buy_item', NULL, NULL),
('weekly', '표정 부자', '이모티콘 20회 사용', 20, 600, 'emote', NULL, NULL),
('weekly', '맷집왕', '함정 피격 25회', 25, 600, 'trap', NULL, NULL),
('weekly', '방방이', '점프 200회', 200, 700, 'jump', NULL, NULL),
('weekly', '포탈 매니아', '포탈 30회 타기', 30, 700, 'portal', NULL, NULL),
('weekly', '바람막이', '송풍기 20회 타기', 20, 700, 'fan', NULL, NULL),
('weekly', '부스트 중독', '부스트 50회 사용', 50, 800, 'boost', NULL, NULL),
('weekly', '맵 건축가', '맵 5회 저장', 5, 800, 'save_map', NULL, NULL),
('weekly', '체크포인트 수집', '체크포인트 50회 통과', 50, 800, 'checkpoint', NULL, NULL),

-- 어려운 난이도 (1,000칩 이상)
('weekly', '배틀 마스터', '멀티 플레이 15회 참여', 15, 1000, 'play_multi', NULL, NULL),
('weekly', '테스터', '다른 유저 맵 10회 플레이', 10, 1000, 'play_custom', NULL, NULL),
('weekly', '마라토너', '총 이동 거리 20,000', 20000, 1000, 'distance', NULL, NULL),
('weekly', '완주자', '맵 완주 10회', 10, 1000, 'finish_map', NULL, NULL),
('weekly', '죽돌이', '플레이 타임 2시간', 7200, 1200, 'play_time', NULL, NULL),
('weekly', '메달리스트', '탑3 5회 달성', 5, 1200, 'top3', NULL, NULL),
('weekly', '승부사', '멀티 3승 달성', 3, 1500, 'win', NULL, NULL),
('weekly', '신입 건축가', '맵 퍼블리싱 1회', 1, 1500, 'publish_map', NULL, NULL),

-- ==================== 업적 (20개) ====================
-- 초반 업적 (쉬움)
('achievement', '첫 걸음', '누적 5판 플레이', 5, 500, 'play_any', NULL, NULL),
('achievement', '승리의 맛', '첫 1승 달성', 1, 1000, 'win', NULL, NULL),

-- 중반 업적 (보통)
('achievement', '익숙한 발걸음', '누적 50판 플레이', 50, 3000, 'play_any', NULL, NULL),
('achievement', '폴짝폴짝', '점프 3,000회 달성', 3000, 5000, 'jump', NULL, NULL),
('achievement', '포탈 여행자', '포탈 300회 이용', 300, 5000, 'portal', NULL, NULL),
('achievement', '꼬마 건축가', '맵 3개 퍼블리싱', 3, 5000, 'publish_map', NULL, NULL),
('achievement', '구사일생', '체력 1%로 완주', 1, 5000, 'finish_1hp', NULL, NULL),
('achievement', '콜렉터', '상점 아이템 10개 구매', 10, 5000, 'buy_item', NULL, NULL),
('achievement', '소셜 나비', '채팅 500회 달성', 500, 5000, 'chat', NULL, NULL),
('achievement', '불사신', '낙사 1,000회', 1000, 5000, 'fall', 'skin', 'zombie'),

-- 후반 업적 (어려움)
('achievement', '올라운더', '5가지 스킨으로 승리', 5, 8000, 'win_diff_skins', NULL, NULL),
('achievement', '부스터 매니아', '부스트 5,000회', 5000, 8000, 'boost', NULL, NULL),
('achievement', '롤링 마스터', '누적 300판 플레이', 300, 10000, 'play_any', 'title', 'master'),
('achievement', '고인물', '상위 1% 기록 달성', 1, 10000, 'top_1_percent', NULL, NULL),
('achievement', '이벤트 헌터', '맵 완주 500회', 500, 15000, 'finish_map', 'title', 'hunter'),
('achievement', '지구 한 바퀴', '이동거리 200,000', 200000, 15000, 'distance', 'trail', 'globe'),

-- 최종 업적 (매우 어려움)
('achievement', '도박사', '누적 100,000칩 획득', 100000, 20000, 'earn_chips', 'skin', 'gold'),
('achievement', '마스터 빌더', '좋아요 100개 받기', 100, 30000, 'receive_like', 'title', 'architect'),
('achievement', '최고의 경지', '크롬 랭크 달성', 1, 30000, 'reach_chrome', 'trail', 'vvip'),
('achievement', '개근상 (금)', '로그인 100일', 100, 50000, 'login', 'skin', 'anniversary1'),

-- ==================== 히든 업적 (5개) ====================
('hidden', '비밀번호가 뭔가요?', '비밀번호 3회 변경', 3, 2000, 'change_pw', 'title', 'amnesia'),
('hidden', '럭키 세븐', '정확히 7777칩 보유', 1, 7777, 'exact_7777', NULL, NULL),
('hidden', '평화주의자', '부스트 없이 완주', 1, 5000, 'no_boost_finish', 'skin', 'turtle'),
('hidden', '텅장', '칩 0개 만들기', 1, 1000, 'zero_chips', NULL, NULL),
('hidden', '마우스 압수', '키보드만으로 완주', 1, 5000, 'keyboard_only', NULL, NULL);
