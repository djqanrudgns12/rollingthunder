export interface ShopItem {
  item_id: string;
  category: 'skin' | 'avatar' | 'border' | 'piece' | 'background' | 'frame';
  name: string;
  price: number;
  rarity: 'Normal' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';
  description: string;
  image: string;
  requiresPremium?: boolean;
}

export const MOCK_ITEMS: ShopItem[] = [
  // ===================== SKINS =====================
  // Normal (500 ~ 1000)
  { item_id: "skin_shuriken", category: "skin", name: "표창", price: 500, rarity: "Normal", description: "날렵한 표창 스킨입니다.", image: "/images/assets/skins/shuriken.png" },
  { item_id: "skin_car", category: "skin", name: "스포츠카", price: 800, rarity: "Normal", description: "빠르게 질주하는 스포츠카 스킨입니다.", image: "/images/assets/skins/car.png" },
  { item_id: "skin_cat", category: "skin", name: "고양이", price: 1000, rarity: "Normal", description: "귀여운 고양이 스킨입니다.", image: "/images/assets/skins/cat.png" },
  { item_id: "skin_blackhole", category: "skin", name: "블랙홀", price: 1000, rarity: "Normal", description: "모든 것을 빨아들이는 블랙홀 스킨입니다.", image: "/images/assets/skins/blackhole.png" },
  
  // Rare (2000)
  { item_id: "skin_pr_alien", category: "skin", name: "에일리언", price: 2000, rarity: "Rare", description: "외계 생명체 에일리언 스킨입니다.", image: "/images/assets/skins/pr_alien.png" },
  { item_id: "skin_pr_ghost", category: "skin", name: "유령", price: 2000, rarity: "Rare", description: "벽을 통과하는 유령 스킨입니다.", image: "/images/assets/skins/pr_ghost.png" },
  { item_id: "skin_pr_slime", category: "skin", name: "슬라임", price: 2000, rarity: "Rare", description: "말랑말랑한 슬라임 스킨입니다.", image: "/images/assets/skins/pr_slime.png" },
  { item_id: "skin_pr_gummy", category: "skin", name: "구미베어", price: 2000, rarity: "Rare", description: "달콤한 구미베어 스킨입니다.", image: "/images/assets/skins/pr_gummy.png" },
  { item_id: "skin_pr_hamster", category: "skin", name: "햄스터", price: 2000, rarity: "Rare", description: "귀여운 햄스터 스킨입니다.", image: "/images/assets/skins/pr_hamster.png" },
  
  // Epic (5000)
  { item_id: "skin_pr_astronaut", category: "skin", name: "우주비행사", price: 5000, rarity: "Epic", description: "우주를 유영하는 우주비행사 스킨입니다.", image: "/images/assets/skins/pr_astronaut.png" },
  { item_id: "skin_pr_dino", category: "skin", name: "공룡", price: 5000, rarity: "Epic", description: "선사시대 공룡 스킨입니다.", image: "/images/assets/skins/pr_dino.png" },
  { item_id: "skin_pr_hotairballoon", category: "skin", name: "열기구", price: 5000, rarity: "Epic", description: "하늘을 나는 열기구 스킨입니다.", image: "/images/assets/skins/pr_hotairballoon.png" },
  { item_id: "skin_pr_pirateship", category: "skin", name: "해적선", price: 5000, rarity: "Epic", description: "바다를 누비는 해적선 스킨입니다.", image: "/images/assets/skins/pr_pirateship.png" },
  { item_id: "skin_pr_robot", category: "skin", name: "로봇", price: 5000, rarity: "Epic", description: "미래형 로봇 스킨입니다.", image: "/images/assets/skins/pr_robot.png" },
  
  // Legendary (10000)
  { item_id: "skin_pr_dragon", category: "skin", name: "드래곤", price: 10000, rarity: "Legendary", description: "불을 뿜는 전설의 드래곤 스킨입니다.", image: "/images/assets/skins/pr_dragon.png" },
  { item_id: "skin_pr_magiccarpet", category: "skin", name: "마법 양탄자", price: 10000, rarity: "Legendary", description: "하늘을 나는 마법 양탄자 스킨입니다.", image: "/images/assets/skins/pr_magiccarpet.png" },
  { item_id: "skin_pr_phoenix", category: "skin", name: "불사조", price: 10000, rarity: "Legendary", description: "영원히 타오르는 불사조 스킨입니다.", image: "/images/assets/skins/pr_phoenix.png" },
  { item_id: "skin_pr_unicorn", category: "skin", name: "유니콘", price: 10000, rarity: "Legendary", description: "환상 속의 유니콘 스킨입니다.", image: "/images/assets/skins/pr_unicorn.png" },

  // ===================== AVATARS =====================
  // 1. 카지노 펫 시리즈 (Normal, 1000C)
  { item_id: "avatar_pet_1", category: "avatar", name: "웰시코기 딜러", price: 1000, rarity: "Normal", description: "딜러 보타이를 맨 귀여운 웰시코기 강아지입니다.", image: "/avatars/pet_corgi.png" },
  { item_id: "avatar_pet_2", category: "avatar", name: "턱시도 냥이", price: 1000, rarity: "Normal", description: "카지노 칩을 굴리며 노는 도도한 고양이입니다.", image: "/avatars/pet_cat.png" },
  { item_id: "avatar_pet_3", category: "avatar", name: "행운의 토끼", price: 1000, rarity: "Normal", description: "네잎클로버를 품은 행운의 토끼입니다.", image: "/avatars/pet_rabbit.png" },
  { item_id: "avatar_pet_4", category: "avatar", name: "룰렛 햄스터", price: 1000, rarity: "Normal", description: "쳇바퀴 대신 룰렛을 도는 귀여운 햄스터입니다.", image: "/avatars/pet_hamster.png" },
  { item_id: "avatar_pet_5", category: "avatar", name: "골드 헌터 여우", price: 1000, rarity: "Normal", description: "황금 코인을 모으는 숲속의 영리한 여우입니다.", image: "/avatars/pet_fox.png" },
  { item_id: "avatar_pet_6", category: "avatar", name: "모노클 부엉이", price: 1000, rarity: "Normal", description: "모노클을 쓴 똑똑하고 점잖은 부엉이 딜러입니다.", image: "/avatars/pet_owl.png" },

  // 2. 장난감 블록 카지노 시리즈 (Rare, 2000C)
  { item_id: "avatar_lego_1", category: "avatar", name: "블록 기사", price: 2000, rarity: "Rare", description: "칩 방패를 든 귀여운 장난감 기사 피규어입니다.", image: "/avatars/lego_knight.png" },
  { item_id: "avatar_lego_2", category: "avatar", name: "블록 해적", price: 2000, rarity: "Rare", description: "금화 더미 위에 선 장난감 해적 피규어입니다.", image: "/avatars/lego_pirate.png" },
  { item_id: "avatar_lego_3", category: "avatar", name: "블록 우주인", price: 2000, rarity: "Rare", description: "무중력 카지노를 탐험하는 우주인 피규어입니다.", image: "/avatars/lego_astronaut.png" },
  { item_id: "avatar_lego_4", category: "avatar", name: "블록 닌자", price: 2000, rarity: "Rare", description: "주사위를 무기처럼 다루는 장난감 닌자입니다.", image: "/avatars/lego_ninja.png" },
  { item_id: "avatar_lego_5", category: "avatar", name: "블록 카우보이", price: 2000, rarity: "Rare", description: "룰렛을 돌리는 멋진 장난감 카우보이입니다.", image: "/avatars/lego_cowboy.png" },
  { item_id: "avatar_lego_6", category: "avatar", name: "블록 킹", price: 2000, rarity: "Rare", description: "칩 왕좌에 앉은 위엄있는 장난감 왕입니다.", image: "/avatars/lego_king.png" },
  { item_id: "avatar_lego_7", category: "avatar", name: "블록 퀸", price: 2000, rarity: "Rare", description: "로얄 플러시를 쥔 우아한 장난감 여왕입니다.", image: "/avatars/lego_queen.png" },
  { item_id: "avatar_lego_8", category: "avatar", name: "블록 경찰", price: 2000, rarity: "Rare", description: "카지노 금고를 지키는 든든한 경찰 피규어입니다.", image: "/avatars/lego_police.png" },
  { item_id: "avatar_lego_9", category: "avatar", name: "블록 요리사", price: 2000, rarity: "Rare", description: "포커 칩을 요리하는 귀여운 셰프 피규어입니다.", image: "/avatars/lego_chef.png" },
  { item_id: "avatar_lego_10", category: "avatar", name: "블록 로봇", price: 2000, rarity: "Rare", description: "카드를 섞는 장난감 로봇 피규어입니다.", image: "/avatars/lego_robot.png" },

  // 4. 귀여운 클레이 캐릭터 (Rare, 3000C)
  { item_id: "avatar_clay_1", category: "avatar", name: "스마일 주사위", price: 3000, rarity: "Rare", description: "방긋 웃는 붉은색 점토 주사위입니다.", image: "/avatars/clay_dice.png" },
  { item_id: "avatar_clay_2", category: "avatar", name: "통통 포커칩", price: 3000, rarity: "Rare", description: "포동포동한 볼살의 점토 포커 칩입니다.", image: "/avatars/clay_chip.png" },
  { item_id: "avatar_clay_3", category: "avatar", name: "미니 슬롯", price: 3000, rarity: "Rare", description: "크고 귀여운 눈을 가진 미니 점토 슬롯머신입니다.", image: "/avatars/clay_slot.png" },
  { item_id: "avatar_clay_4", category: "avatar", name: "미니 룰렛", price: 3000, rarity: "Rare", description: "아기자기한 장난감 같은 점토 룰렛 휠입니다.", image: "/avatars/clay_roulette.png" },
  { item_id: "avatar_clay_5", category: "avatar", name: "워킹 트럼프", price: 3000, rarity: "Rare", description: "팔다리가 달린 장난꾸러기 점토 플레잉 카드입니다.", image: "/avatars/clay_card.png" },
  { item_id: "avatar_clay_6", category: "avatar", name: "윙크 편자", price: 3000, rarity: "Rare", description: "행운을 부르는 황금 점토 말발굽입니다.", image: "/avatars/clay_horseshoe.png" },

  // 3. 트럼프 왕국 왕실 캐릭터 (Epic, 5000C)
  { item_id: "avatar_royal_1", category: "avatar", name: "스페이드 킹", price: 5000, rarity: "Epic", description: "거대한 왕관을 쓴 근엄한 스페이드 왕국 꼬마 왕입니다.", image: "/avatars/royal_king.png" },
  { item_id: "avatar_royal_2", category: "avatar", name: "하트 퀸", price: 5000, rarity: "Epic", description: "하트 요술봉을 든 우아한 꼬마 여왕입니다.", image: "/avatars/royal_queen.png" },
  { item_id: "avatar_royal_3", category: "avatar", name: "다이아몬드 잭", price: 5000, rarity: "Epic", description: "창을 든 늠름한 다이아몬드 기사 꼬마입니다.", image: "/avatars/royal_jack.png" },
  { item_id: "avatar_royal_4", category: "avatar", name: "클로버 조커", price: 5000, rarity: "Epic", description: "다채로운 옷을 입고 익살스럽게 웃는 꼬마 조커입니다.", image: "/avatars/royal_joker.png" },
  { item_id: "avatar_royal_5", category: "avatar", name: "에이스 대천사", price: 5000, rarity: "Epic", description: "빛나는 에이스 문양을 수호하는 꼬마 천사입니다.", image: "/avatars/royal_ace.png" },

  // 5. 외계인 시리즈 (Legendary, 10000C)
  { item_id: "avatar_alien_1", category: "avatar", name: "선글라스 에일리언", price: 10000, rarity: "Legendary", description: "선글라스를 낀 힙한 클래식 외계인입니다.", image: "/avatars/alien_green.png" },
  { item_id: "avatar_alien_2", category: "avatar", name: "문어발 에일리언", price: 10000, rarity: "Legendary", description: "여러 개의 보라색 촉수로 카드를 섞는 외계인입니다.", image: "/avatars/alien_tentacle.png" },
  { item_id: "avatar_alien_3", category: "avatar", name: "사이보그 에일리언", price: 10000, rarity: "Legendary", description: "기계 부품과 결합된 귀여운 사이보그 외계인입니다.", image: "/avatars/alien_cyborg.png" },
  { item_id: "avatar_alien_4", category: "avatar", name: "사이클롭스 몬스터", price: 10000, rarity: "Legendary", description: "커다란 눈 하나로 상대를 압도하는 귀여운 외계인입니다.", image: "/avatars/alien_cyclops.png" },
  { item_id: "avatar_alien_5", category: "avatar", name: "지니어스 브레인", price: 10000, rarity: "Legendary", description: "유리 돔 안에 든 천재 두뇌 외계인입니다.", image: "/avatars/alien_brain.png" },

  // 6. 카지노 딜러 시리즈 (Legendary, 15000C)
  { item_id: "avatar_dealer_1", category: "avatar", name: "펭귄 딜러", price: 15000, rarity: "Legendary", description: "말끔한 정장 차림의 신사적인 펭귄 딜러입니다.", image: "/avatars/dealer_penguin.png" },
  { item_id: "avatar_dealer_2", category: "avatar", name: "AI 홀로그램 딜러", price: 15000, rarity: "Legendary", description: "홀로그램 눈빛으로 승률을 계산하는 로봇 딜러입니다.", image: "/avatars/dealer_robot.png" },
  { item_id: "avatar_dealer_3", category: "avatar", name: "크라켄 딜러", price: 15000, rarity: "Legendary", description: "8개의 다리로 눈보다 빠르게 카드를 섞는 문어입니다.", image: "/avatars/dealer_octopus.png" },
  { item_id: "avatar_dealer_4", category: "avatar", name: "팬텀 딜러", price: 15000, rarity: "Legendary", description: "테이블 위를 떠다니며 게임을 주도하는 유령 딜러입니다.", image: "/avatars/dealer_ghost.png" },
  { item_id: "avatar_dealer_5", category: "avatar", name: "몽키 딜러", price: 15000, rarity: "Legendary", description: "바나나 칩을 건네며 환하게 웃는 원숭이 딜러입니다.", image: "/avatars/dealer_monkey.png" },
  { item_id: "avatar_dealer_6", category: "avatar", name: "드래곤 딜러", price: 15000, rarity: "Legendary", description: "승리자에게 앙증맞은 불꽃을 뿜어주는 아기 드래곤입니다.", image: "/avatars/dealer_dragon.png" },

  // 7. 사이버펑크 스컬 딜러 시리즈 (Mythic, 50000C)
  { item_id: "avatar_skull_1", category: "avatar", name: "블러드 해커 스컬", price: 50000, rarity: "Mythic", description: "붉은 네온 에너지를 뿜어내는 어둠의 해커 스컬입니다.", image: "/avatars/skull_red.png" },
  { item_id: "avatar_skull_2", category: "avatar", name: "코어 데이터 스컬", price: 50000, rarity: "Mythic", description: "푸른색 홀로그램 데이터 스트림을 다루는 사이보그 스컬입니다.", image: "/avatars/skull_blue.png" },
  { item_id: "avatar_skull_3", category: "avatar", name: "매트릭스 스컬", price: 50000, rarity: "Mythic", description: "치명적인 녹색 네온과 매트릭스 코드가 흐르는 스컬입니다.", image: "/avatars/skull_green.png" },
  { item_id: "avatar_skull_4", category: "avatar", name: "팬텀 아우라 스컬", price: 50000, rarity: "Mythic", description: "보라색 영혼의 불꽃을 두르고 있는 신비로운 팬텀 스컬입니다.", image: "/avatars/skull_purple.png" },
  { item_id: "avatar_skull_5", category: "avatar", name: "골든 엠퍼러 스컬", price: 50000, rarity: "Mythic", description: "카지노의 제왕임을 증명하는 눈부신 순금 마스크 스컬입니다.", image: "/avatars/skull_gold.png" },

  // ===================== BORDERS =====================
  { item_id: "border_coming_soon", category: "border", name: "테두리(준비중)", price: 0, rarity: "Normal", description: "추후 업데이트 예정입니다.", image: "" },

  // ===================== PIECES (OBSTACLES) =====================
  { item_id: "piece_bumper", category: "piece", name: "플라즈마 범퍼", price: 3000, rarity: "Rare", description: "부딪히면 튕겨내는 플라즈마 범퍼입니다.", image: "/images/assets/obstacles/bumper_plasma.png", requiresPremium: true },
  { item_id: "piece_blackhole", category: "piece", name: "블랙홀 장애물", price: 5000, rarity: "Epic", description: "모든 것을 빨아들이는 블랙홀입니다.", image: "/images/assets/obstacles/blackhole.png", requiresPremium: true },
  { item_id: "piece_portal", category: "piece", name: "포털 게이트", price: 8000, rarity: "Epic", description: "공간을 이동하는 포털 게이트입니다.", image: "/images/assets/obstacles/portal_gate.png", requiresPremium: true },
  { item_id: "piece_booster", category: "piece", name: "부스터 패드", price: 3000, rarity: "Rare", description: "속도를 올려주는 부스터 패드입니다.", image: "/images/assets/obstacles/booster_pad.png", requiresPremium: true },
  { item_id: "piece_windmill", category: "piece", name: "풍차 회전 날개", price: 4000, rarity: "Rare", description: "회전하며 장애물이 되는 풍차 날개입니다.", image: "/images/assets/obstacles/windmill_rotor.png", requiresPremium: true },
  { item_id: "piece_wall_cyber", category: "piece", name: "사이버 월", price: 10000, rarity: "Legendary", description: "미래지향적인 사이버 벽입니다.", image: "/images/assets/obstacles/wall_cyber.png", requiresPremium: true },
  { item_id: "piece_pin_neon", category: "piece", name: "네온 핀", price: 5000, rarity: "Epic", description: "빛나는 네온 핀입니다.", image: "/images/assets/obstacles/pin_neon.png", requiresPremium: true },

  // ===================== BACKGROUNDS =====================
  { item_id: "bg_cyberpunk", category: "background", name: "사이버펑크 메가시티", price: 5000, rarity: "Epic", description: "미래 도시의 화려한 야경입니다.", image: "/images/assets/bg_cyberpunk_megacity_1782785606020.jpg", requiresPremium: true },
  { item_id: "bg_deep_space", category: "background", name: "심우주 성운", price: 7000, rarity: "Legendary", description: "신비로운 우주의 성운입니다.", image: "/images/assets/bg_deep_space_nebula_1782785644285.jpg", requiresPremium: true },
  { item_id: "bg_neon_synthwave", category: "background", name: "네온 신스웨이브", price: 6000, rarity: "Epic", description: "레트로 퓨처리즘 감성의 배경입니다.", image: "/images/assets/bg_neon_synthwave_ultra.png", requiresPremium: true },
  { item_id: "bg_enchanted_forest", category: "background", name: "마법의 숲", price: 4000, rarity: "Rare", description: "신비로운 빛이 감도는 숲입니다.", image: "/images/assets/bg_enchanted_forest_1782785674317.jpg", requiresPremium: true },
  { item_id: "bg_lava_volcano", category: "background", name: "용암 화산", price: 4000, rarity: "Rare", description: "펄펄 끓는 용암이 흐르는 화산입니다.", image: "/images/assets/bg_lava_volcano_core_1782785625035.jpg", requiresPremium: true },
  { item_id: "bg_quantum_realm", category: "background", name: "양자 영역", price: 8000, rarity: "Legendary", description: "미시 세계의 양자 영역입니다.", image: "/images/assets/bg_quantum_realm_1782785877783.jpg", requiresPremium: true },
  { item_id: "bg_virtual_matrix", category: "background", name: "가상 매트릭스", price: 5000, rarity: "Epic", description: "데이터가 흐르는 가상 매트릭스 공간입니다.", image: "/images/assets/bg_virtual_matrix_grid_1782785744588.jpg", requiresPremium: true },

  // ===================== FRAMES =====================
  { item_id: "frame_gold", category: "frame", name: "골드 프레임", price: 3000, rarity: "Rare", description: "맵의 외곽을 황금빛으로 감쌉니다.", image: "", requiresPremium: true },
  { item_id: "frame_neon", category: "frame", name: "네온 프레임", price: 5000, rarity: "Epic", description: "맵의 외곽을 화려한 네온빛으로 감쌉니다.", image: "", requiresPremium: true },
  { item_id: "frame_obsidian", category: "frame", name: "흑요석 프레임", price: 7000, rarity: "Legendary", description: "맵의 외곽을 단단한 흑요석으로 감쌉니다.", image: "", requiresPremium: true },
];
