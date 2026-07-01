export const MOCK_ITEMS = [
  // 기존 아이템
  { item_id: "1", category: "skin", name: "네온 크롬 수트", price: 5000, rarity: "에픽", description: "눈부시게 빛나는 네온 수트입니다.", image: "" },
  { item_id: "2", category: "piece", name: "황금 폰", price: 10000, rarity: "전설", description: "순금으로 정교하게 만들어진 게임 말입니다.", image: "" },
  { item_id: "3", category: "frame", name: "루비 테두리", price: 2000, rarity: "희귀", description: "고급스러운 붉은빛 루비 프로필 액자입니다.", image: "" },
  { item_id: "4", category: "background", name: "카지노 네온사인", price: 3000, rarity: "에픽", description: "화려하고 역동적인 카지노 테마의 배경입니다.", image: "" },

  // 1. 카지노 펫 시리즈 (노멀, 1000C)
  { item_id: "avatar_pet_1", category: "avatar", name: "웰시코기 딜러", price: 1000, rarity: "노멀", description: "딜러 보타이를 맨 귀여운 웰시코기 강아지입니다.", image: "/avatars/pet_corgi.png" },
  { item_id: "avatar_pet_2", category: "avatar", name: "턱시도 냥이", price: 1000, rarity: "노멀", description: "카지노 칩을 굴리며 노는 도도한 고양이입니다.", image: "/avatars/pet_cat.png" },
  { item_id: "avatar_pet_3", category: "avatar", name: "행운의 토끼", price: 1000, rarity: "노멀", description: "네잎클로버를 품은 행운의 토끼입니다.", image: "/avatars/pet_rabbit.png" },
  { item_id: "avatar_pet_4", category: "avatar", name: "룰렛 햄스터", price: 1000, rarity: "노멀", description: "쳇바퀴 대신 룰렛을 도는 귀여운 햄스터입니다.", image: "/avatars/pet_hamster.png" },
  { item_id: "avatar_pet_5", category: "avatar", name: "골드 헌터 여우", price: 1000, rarity: "노멀", description: "황금 코인을 모으는 숲속의 영리한 여우입니다.", image: "/avatars/pet_fox.png" },
  { item_id: "avatar_pet_6", category: "avatar", name: "모노클 부엉이", price: 1000, rarity: "노멀", description: "모노클을 쓴 똑똑하고 점잖은 부엉이 딜러입니다.", image: "/avatars/pet_owl.png" },

  // 2. 장난감 블록 카지노 시리즈 (레어, 2000C)
  { item_id: "avatar_lego_1", category: "avatar", name: "블록 기사", price: 2000, rarity: "레어", description: "칩 방패를 든 귀여운 장난감 기사 피규어입니다.", image: "/avatars/lego_knight.png" },
  { item_id: "avatar_lego_2", category: "avatar", name: "블록 해적", price: 2000, rarity: "레어", description: "금화 더미 위에 선 장난감 해적 피규어입니다.", image: "/avatars/lego_pirate.png" },
  { item_id: "avatar_lego_3", category: "avatar", name: "블록 우주인", price: 2000, rarity: "레어", description: "무중력 카지노를 탐험하는 우주인 피규어입니다.", image: "/avatars/lego_astronaut.png" },
  { item_id: "avatar_lego_4", category: "avatar", name: "블록 닌자", price: 2000, rarity: "레어", description: "주사위를 무기처럼 다루는 장난감 닌자입니다.", image: "/avatars/lego_ninja.png" },
  { item_id: "avatar_lego_5", category: "avatar", name: "블록 카우보이", price: 2000, rarity: "레어", description: "룰렛을 돌리는 멋진 장난감 카우보이입니다.", image: "/avatars/lego_cowboy.png" },
  { item_id: "avatar_lego_6", category: "avatar", name: "블록 킹", price: 2000, rarity: "레어", description: "칩 왕좌에 앉은 위엄있는 장난감 왕입니다.", image: "/avatars/lego_king.png" },
  { item_id: "avatar_lego_7", category: "avatar", name: "블록 퀸", price: 2000, rarity: "레어", description: "로얄 플러시를 쥔 우아한 장난감 여왕입니다.", image: "/avatars/lego_queen.png" },
  { item_id: "avatar_lego_8", category: "avatar", name: "블록 경찰", price: 2000, rarity: "레어", description: "카지노 금고를 지키는 든든한 경찰 피규어입니다.", image: "/avatars/lego_police.png" },
  { item_id: "avatar_lego_9", category: "avatar", name: "블록 요리사", price: 2000, rarity: "레어", description: "포커 칩을 요리하는 귀여운 셰프 피규어입니다.", image: "/avatars/lego_chef.png" },
  { item_id: "avatar_lego_10", category: "avatar", name: "블록 로봇", price: 2000, rarity: "레어", description: "카드를 섞는 장난감 로봇 피규어입니다.", image: "/avatars/lego_robot.png" },

  // 3. 트럼프 왕국 왕실 캐릭터 (에픽, 5000C)
  { item_id: "avatar_royal_1", category: "avatar", name: "스페이드 킹", price: 5000, rarity: "에픽", description: "거대한 왕관을 쓴 근엄한 스페이드 왕국 꼬마 왕입니다.", image: "/avatars/royal_king.png" },
  { item_id: "avatar_royal_2", category: "avatar", name: "하트 퀸", price: 5000, rarity: "에픽", description: "하트 요술봉을 든 우아한 꼬마 여왕입니다.", image: "/avatars/royal_queen.png" },
  { item_id: "avatar_royal_3", category: "avatar", name: "다이아몬드 잭", price: 5000, rarity: "에픽", description: "창을 든 늠름한 다이아몬드 기사 꼬마입니다.", image: "/avatars/royal_jack.png" },
  { item_id: "avatar_royal_4", category: "avatar", name: "클로버 조커", price: 5000, rarity: "에픽", description: "다채로운 옷을 입고 익살스럽게 웃는 꼬마 조커입니다.", image: "/avatars/royal_joker.png" },
  { item_id: "avatar_royal_5", category: "avatar", name: "에이스 대천사", price: 5000, rarity: "에픽", description: "빛나는 에이스 문양을 수호하는 꼬마 천사입니다.", image: "/avatars/royal_ace.png" },

  // 4. 귀여운 클레이 캐릭터 (레어, 3000C)
  { item_id: "avatar_clay_1", category: "avatar", name: "스마일 주사위", price: 3000, rarity: "레어", description: "방긋 웃는 붉은색 점토 주사위입니다.", image: "/avatars/clay_dice.png" },
  { item_id: "avatar_clay_2", category: "avatar", name: "통통 포커칩", price: 3000, rarity: "레어", description: "포동포동한 볼살의 점토 포커 칩입니다.", image: "/avatars/clay_chip.png" },
  { item_id: "avatar_clay_3", category: "avatar", name: "미니 슬롯", price: 3000, rarity: "레어", description: "크고 귀여운 눈을 가진 미니 점토 슬롯머신입니다.", image: "/avatars/clay_slot.png" },
  { item_id: "avatar_clay_4", category: "avatar", name: "미니 룰렛", price: 3000, rarity: "레어", description: "아기자기한 장난감 같은 점토 룰렛 휠입니다.", image: "/avatars/clay_roulette.png" },
  { item_id: "avatar_clay_5", category: "avatar", name: "워킹 트럼프", price: 3000, rarity: "레어", description: "팔다리가 달린 장난꾸러기 점토 플레잉 카드입니다.", image: "/avatars/clay_card.png" },
  { item_id: "avatar_clay_6", category: "avatar", name: "윙크 편자", price: 3000, rarity: "레어", description: "행운을 부르는 황금 점토 말발굽입니다.", image: "/avatars/clay_horseshoe.png" },

  // 5. 외계인 시리즈 (전설, 10000C)
  { item_id: "avatar_alien_1", category: "avatar", name: "선글라스 에일리언", price: 10000, rarity: "전설", description: "선글라스를 낀 힙한 클래식 외계인입니다.", image: "/avatars/alien_green.png" },
  { item_id: "avatar_alien_2", category: "avatar", name: "문어발 에일리언", price: 10000, rarity: "전설", description: "여러 개의 보라색 촉수로 카드를 섞는 외계인입니다.", image: "/avatars/alien_tentacle.png" },
  { item_id: "avatar_alien_3", category: "avatar", name: "사이보그 에일리언", price: 10000, rarity: "전설", description: "기계 부품과 결합된 귀여운 사이보그 외계인입니다.", image: "/avatars/alien_cyborg.png" },
  { item_id: "avatar_alien_4", category: "avatar", name: "사이클롭스 몬스터", price: 10000, rarity: "전설", description: "커다란 눈 하나로 상대를 압도하는 귀여운 외계인입니다.", image: "/avatars/alien_cyclops.png" },
  { item_id: "avatar_alien_5", category: "avatar", name: "지니어스 브레인", price: 10000, rarity: "전설", description: "유리 돔 안에 든 천재 두뇌 외계인입니다.", image: "/avatars/alien_brain.png" },

  // 6. 카지노 딜러 시리즈 (전설, 15000C)
  { item_id: "avatar_dealer_1", category: "avatar", name: "펭귄 딜러", price: 15000, rarity: "전설", description: "말끔한 정장 차림의 신사적인 펭귄 딜러입니다.", image: "/avatars/dealer_penguin.png" },
  { item_id: "avatar_dealer_2", category: "avatar", name: "AI 홀로그램 딜러", price: 15000, rarity: "전설", description: "홀로그램 눈빛으로 승률을 계산하는 로봇 딜러입니다.", image: "/avatars/dealer_robot.png" },
  { item_id: "avatar_dealer_3", category: "avatar", name: "크라켄 딜러", price: 15000, rarity: "전설", description: "8개의 다리로 눈보다 빠르게 카드를 섞는 문어입니다.", image: "/avatars/dealer_octopus.png" },
  { item_id: "avatar_dealer_4", category: "avatar", name: "팬텀 딜러", price: 15000, rarity: "전설", description: "테이블 위를 떠다니며 게임을 주도하는 유령 딜러입니다.", image: "/avatars/dealer_ghost.png" },
  { item_id: "avatar_dealer_5", category: "avatar", name: "몽키 딜러", price: 15000, rarity: "전설", description: "바나나 칩을 건네며 환하게 웃는 원숭이 딜러입니다.", image: "/avatars/dealer_monkey.png" },
  { item_id: "avatar_dealer_6", category: "avatar", name: "드래곤 딜러", price: 15000, rarity: "전설", description: "승리자에게 앙증맞은 불꽃을 뿜어주는 아기 드래곤입니다.", image: "/avatars/dealer_dragon.png" },

  // 7. 사이버펑크 스컬 딜러 시리즈 (신화, 50000C)
  { item_id: "avatar_skull_1", category: "avatar", name: "블러드 해커 스컬", price: 50000, rarity: "신화", description: "붉은 네온 에너지를 뿜어내는 어둠의 해커 스컬입니다.", image: "/avatars/skull_red.png" },
  { item_id: "avatar_skull_2", category: "avatar", name: "코어 데이터 스컬", price: 50000, rarity: "신화", description: "푸른색 홀로그램 데이터 스트림을 다루는 사이보그 스컬입니다.", image: "/avatars/skull_blue.png" },
  { item_id: "avatar_skull_3", category: "avatar", name: "매트릭스 스컬", price: 50000, rarity: "신화", description: "치명적인 녹색 네온과 매트릭스 코드가 흐르는 스컬입니다.", image: "/avatars/skull_green.png" },
  { item_id: "avatar_skull_4", category: "avatar", name: "팬텀 아우라 스컬", price: 50000, rarity: "신화", description: "보라색 영혼의 불꽃을 두르고 있는 신비로운 팬텀 스컬입니다.", image: "/avatars/skull_purple.png" },
  { item_id: "avatar_skull_5", category: "avatar", name: "골든 엠퍼러 스컬", price: 50000, rarity: "신화", description: "카지노의 제왕임을 증명하는 눈부신 순금 마스크 스컬입니다.", image: "/avatars/skull_gold.png" },
];
