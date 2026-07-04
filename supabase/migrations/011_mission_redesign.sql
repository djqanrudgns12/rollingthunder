-- ================================================================
-- 011: 미션 시스템 전면 재설계
-- 실제 구현된 기능만으로 달성 가능한 미션으로 교체
-- 기존 70개 → 42개 (일일 15 + 주간 12 + 업적 12 + 히든 3)
-- ================================================================

-- 1. 기존 데이터 정리
DELETE FROM user_missions;
DELETE FROM user_achievements;
DELETE FROM missions;

-- 2. 일일 미션 (15개, 매일 5개 랜덤 할당)
INSERT INTO missions (type, title, description, goal_amount, reward_chips, condition_type) VALUES
('daily', '출석 체크', '게임에 로그인하기', 1, 100, 'login'),
('daily', '첫 시뮬레이션', '게임 1판 돌리기', 1, 150, 'play_game'),
('daily', '트리플 런', '게임 3판 돌리기', 3, 300, 'play_game'),
('daily', '맵 탐험가', '다른 맵으로 게임하기', 1, 150, 'change_map'),
('daily', '장인 정신', '맵 에디터 열기', 1, 100, 'open_editor'),
('daily', '설계의 기쁨', '맵 저장 1회', 1, 150, 'save_map'),
('daily', '아이쇼핑', '상점 방문 1회', 1, 80, 'visit_shop'),
('daily', '구매왕', '상점에서 아이템 구매 1회', 1, 150, 'buy_item'),
('daily', '행운의 룰렛', '럭키 룰렛 1회 돌리기', 1, 100, 'gacha_spin'),
('daily', '대규모 전투', '10명 이상 참가자로 게임', 1, 200, 'play_10plus'),
('daily', '관전의 묘미', '게임 끝까지 관전하기', 1, 200, 'watch_finish'),
('daily', '명단 관리자', '참가자 5명 이상 등록', 1, 100, 'add_5_participants'),
('daily', '리스트 마스터', '참가자 명단 저장', 1, 150, 'save_list'),
('daily', '스탬프북 확인', '스탬프북 열기', 1, 80, 'open_stampbook'),
('daily', '프로필 확인', '프로필 페이지 방문', 1, 80, 'visit_profile');

-- 3. 주간 미션 (12개, 매주 5개 랜덤 할당)
INSERT INTO missions (type, title, description, goal_amount, reward_chips, condition_type) VALUES
('weekly', '시뮬레이션 마니아', '게임 10판 돌리기', 10, 1000, 'play_game'),
('weekly', '다양한 맵', '다른 맵 3개로 게임', 3, 800, 'change_map'),
('weekly', '맵 제작자', '맵 3회 저장', 3, 1000, 'save_map'),
('weekly', '쇼핑 중독', '아이템 3회 구매', 3, 800, 'buy_item'),
('weekly', '도박왕', '럭키 룰렛 5회 돌리기', 5, 1000, 'gacha_spin'),
('weekly', '대장정', '게임 20판 돌리기', 20, 2000, 'play_game'),
('weekly', '건축 거장', '맵 배포(is_official) 1회', 1, 1500, 'publish_map'),
('weekly', '관전 마니아', '게임 끝까지 5회 관전', 5, 1200, 'watch_finish'),
('weekly', '대규모 운영', '10명+ 게임 5판', 5, 1500, 'play_10plus'),
('weekly', '스탬프 수집가', '미션 보상 3회 수령', 3, 800, 'claim_reward'),
('weekly', '근면 성실', '7일 로그인', 7, 1500, 'login'),
('weekly', '명단 수집가', '명단 3개 저장', 3, 1000, 'save_list');

-- 4. 업적 (12개, 영구 누적)
INSERT INTO missions (type, title, description, goal_amount, reward_chips, condition_type) VALUES
('achievement', '첫 발자국', '첫 게임 돌리기', 1, 500, 'play_game'),
('achievement', '시뮬레이터', '누적 50판 플레이', 50, 3000, 'play_game'),
('achievement', '롤링 마스터', '누적 200판 플레이', 200, 10000, 'play_game'),
('achievement', '만렙 달성', '누적 500판 플레이', 500, 50000, 'play_game'),
('achievement', '첫 구매', '상점 첫 구매', 1, 500, 'buy_item'),
('achievement', '콜렉터', '아이템 10개 구매', 10, 5000, 'buy_item'),
('achievement', '꼬마 건축가', '맵 3개 저장', 3, 3000, 'save_map'),
('achievement', '마스터 빌더', '맵 10개 저장', 10, 10000, 'save_map'),
('achievement', '맵 퍼블리셔', '맵 배포 1회', 1, 5000, 'publish_map'),
('achievement', '행운의 사나이', '룰렛 20회 돌리기', 20, 5000, 'gacha_spin'),
('achievement', '개근상', '누적 30일 로그인', 30, 15000, 'login'),
('achievement', '백전노장', '관전 100회 완료', 100, 20000, 'watch_finish');

-- 5. 히든 업적 (3개)
INSERT INTO missions (type, title, description, goal_amount, reward_chips, condition_type) VALUES
('hidden', '럭키 세븐', '정확히 7777칩 보유', 1, 7777, 'exact_7777'),
('hidden', '텅장', '칩 0개 만들기', 1, 1000, 'zero_chips'),
('hidden', '백인대장', '100명으로 게임', 1, 5000, 'play_100plus');
