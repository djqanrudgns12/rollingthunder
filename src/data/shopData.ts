export interface ShopItem {
  item_id: string;
  category: 'skin' | 'avatar' | 'border' | 'piece' | 'background' | 'frame';
  name: string;
  price: number;
  rarity: 'Normal' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';
  description: string;
  image: string;
  iconName?: string;
  requiresPremium?: boolean;
  isDefault?: boolean;
  /** 이 아이템을 자동 소유하기 위한 최소 등급. 해당 등급 이상이면 자동 보유. */
  requiredRole?: 'guest' | 'user' | 'premium' | 'admin';
}

import { SVG_ASSETS } from '@/lib/SvgAssets';

export const MOCK_ITEMS: ShopItem[] = [
  // ===================== SKINS =====================
  // Default (0)
  { item_id: "skin_chip_base", category: "skin", name: "포커칩", price: 0, rarity: "Normal", description: "기본 지급되는 포커칩 스킨입니다.", image: "", iconName: "Circle", isDefault: true },
  { item_id: "skin_horse", category: "skin", name: "경주마", price: 0, rarity: "Normal", description: "기본 지급되는 경주마 스킨입니다.", image: "", iconName: "Zap", isDefault: true },
  { item_id: "skin_spaceship", category: "skin", name: "우주선", price: 0, rarity: "Normal", description: "기본 지급되는 우주선 스킨입니다.", image: "", iconName: "Rocket", isDefault: true },

  // Normal (1000)
  { item_id: "skin_shuriken", category: "skin", name: "표창", price: 1000, rarity: "Normal", description: "날렵한 표창 스킨입니다.", image: "/images/assets/skins/shuriken.png" },
  { item_id: "skin_soccerball", category: "skin", name: "축구공", price: 1000, rarity: "Normal", description: "둥글게 굴러가는 축구공 스킨입니다.", image: "/images/assets/skins/soccerball.png" },
  { item_id: "skin_cherry", category: "skin", name: "체리", price: 1000, rarity: "Normal", description: "상큼한 두 알의 체리 스킨입니다.", image: "/images/assets/skins/cherry.png" },
  { item_id: "skin_car", category: "skin", name: "스포츠카", price: 1000, rarity: "Normal", description: "빠르게 질주하는 스포츠카 스킨입니다.", image: "/images/assets/skins/car.png" },
  { item_id: "skin_bird", category: "skin", name: "새", price: 1000, rarity: "Normal", description: "하늘을 나는 평화로운 새 스킨입니다.", image: "/images/assets/skins/bird.png" },
  { item_id: "skin_clover", category: "skin", name: "네잎클로버", price: 1000, rarity: "Normal", description: "행운을 가져다주는 네잎클로버 스킨입니다.", image: "/images/assets/skins/clover.png" },
  { item_id: "skin_cat", category: "skin", name: "고양이", price: 1000, rarity: "Normal", description: "귀여운 고양이 스킨입니다.", image: "/images/assets/skins/cat.png" },
  { item_id: "skin_blackhole", category: "skin", name: "블랙홀", price: 1000, rarity: "Normal", description: "모든 것을 빨아들이는 블랙홀 스킨입니다.", image: "/images/assets/skins/blackhole.png" },
  { item_id: "skin_dog", category: "skin", name: "강아지", price: 1000, rarity: "Normal", description: "충성스럽고 귀여운 강아지 스킨입니다.", image: "/images/assets/skins/dog.png" },
  { item_id: "skin_diamond", category: "skin", name: "다이아몬드", price: 1000, rarity: "Normal", description: "영원히 빛나는 다이아몬드 스킨입니다.", image: "/images/assets/skins/diamond.png" },
  { item_id: "skin_rabbit", category: "skin", name: "토끼", price: 1000, rarity: "Normal", description: "깡총깡총 뛰는 토끼 스킨입니다.", image: "/images/assets/skins/rabbit.png" },
  { item_id: "skin_turtle", category: "skin", name: "거북이", price: 1000, rarity: "Normal", description: "느긋하고 단단한 거북이 스킨입니다.", image: "/images/assets/skins/turtle.png" },
  
  // Rare (3000)
  { item_id: "skin_pr_magicpotion", category: "skin", name: "마법 물약", price: 3000, rarity: "Rare", description: "보랏빛 마법의 힘이 담긴 신비한 물약 스킨입니다.", image: "/images/assets/skins/pr_magicpotion.png" },
  { item_id: "skin_pr_paperplane", category: "skin", name: "종이 비행기", price: 3000, rarity: "Rare", description: "하늘을 자유롭게 나는 종이 비행기 스킨입니다.", image: "/images/assets/skins/pr_paperplane.png" },
  { item_id: "skin_pr_rubberduck", category: "skin", name: "고무 오리", price: 3000, rarity: "Rare", description: "욕조에서 막 튀어나온 귀여운 고무 오리 스킨입니다.", image: "/images/assets/skins/pr_rubberduck.png" },
  { item_id: "skin_pr_alien", category: "skin", name: "에일리언", price: 3000, rarity: "Rare", description: "외계 생명체 에일리언 스킨입니다.", image: "/images/assets/skins/pr_alien.png" },
  { item_id: "skin_pr_ghost", category: "skin", name: "유령", price: 3000, rarity: "Rare", description: "벽을 통과하는 유령 스킨입니다.", image: "/images/assets/skins/pr_ghost.png" },
  { item_id: "skin_pr_slime", category: "skin", name: "슬라임", price: 3000, rarity: "Rare", description: "말랑말랑한 슬라임 스킨입니다.", image: "/images/assets/skins/pr_slime.png" },
  { item_id: "skin_pr_gummy", category: "skin", name: "구미베어", price: 3000, rarity: "Rare", description: "달콤한 구미베어 스킨입니다.", image: "/images/assets/skins/pr_gummy.png" },
  { item_id: "skin_pr_hamster", category: "skin", name: "햄스터", price: 3000, rarity: "Rare", description: "귀여운 햄스터 스킨입니다.", image: "/images/assets/skins/pr_hamster.png" },
  
  // Epic (5000)
  { item_id: "skin_pr_mechabeetle", category: "skin", name: "메카 장수풍뎅이", price: 5000, rarity: "Epic", description: "첨단 네온 회로로 무장한 기계 장수풍뎅이 스킨입니다.", image: "/images/assets/skins/pr_mechabeetle.png" },
  { item_id: "skin_pr_hoverboard", category: "skin", name: "호버보드", price: 5000, rarity: "Epic", description: "사이버펑크 감성이 물씬 풍기는 호버보드 스킨입니다.", image: "/images/assets/skins/pr_hoverboard.png" },
  { item_id: "skin_pr_crystalgolem", category: "skin", name: "크리스탈 골렘", price: 5000, rarity: "Epic", description: "마젠타 빛 마력이 감도는 단단한 크리스탈 골렘 스킨입니다.", image: "/images/assets/skins/pr_crystalgolem.png" },
  { item_id: "skin_pr_astronaut", category: "skin", name: "우주비행사", price: 5000, rarity: "Epic", description: "우주를 유영하는 우주비행사 스킨입니다.", image: "/images/assets/skins/pr_astronaut.png" },
  { item_id: "skin_pr_dino", category: "skin", name: "공룡", price: 5000, rarity: "Epic", description: "선사시대 공룡 스킨입니다.", image: "/images/assets/skins/pr_dino.png" },
  { item_id: "skin_pr_hotairballoon", category: "skin", name: "열기구", price: 5000, rarity: "Epic", description: "하늘을 나는 열기구 스킨입니다.", image: "/images/assets/skins/pr_hotairballoon.png" },
  { item_id: "skin_pr_pirateship", category: "skin", name: "해적선", price: 5000, rarity: "Epic", description: "바다를 누비는 해적선 스킨입니다.", image: "/images/assets/skins/pr_pirateship.png" },
  { item_id: "skin_pr_robot", category: "skin", name: "로봇", price: 5000, rarity: "Epic", description: "미래형 로봇 스킨입니다.", image: "/images/assets/skins/pr_robot.png" },
  
  // Legendary (10000)
  { item_id: "skin_pr_leviathan", category: "skin", name: "레비아탄", price: 10000, rarity: "Legendary", description: "휘몰아치는 소용돌이를 다루는 전설의 해신 레비아탄 스킨입니다.", image: "/images/assets/skins/pr_leviathan.png" },
  { item_id: "skin_pr_dragon", category: "skin", name: "드래곤", price: 10000, rarity: "Legendary", description: "불을 뿜는 전설의 드래곤 스킨입니다.", image: "/images/assets/skins/pr_dragon.png" },
  { item_id: "skin_pr_magiccarpet", category: "skin", name: "마법 양탄자", price: 10000, rarity: "Legendary", description: "하늘을 나는 마법 양탄자 스킨입니다.", image: "/images/assets/skins/pr_magiccarpet.png" },
  { item_id: "skin_pr_phoenix", category: "skin", name: "불사조", price: 10000, rarity: "Legendary", description: "영원히 타오르는 불사조 스킨입니다.", image: "/images/assets/skins/pr_phoenix.png" },
  { item_id: "skin_pr_unicorn", category: "skin", name: "유니콘", price: 10000, rarity: "Legendary", description: "환상 속의 유니콘 스킨입니다.", image: "/images/assets/skins/pr_unicorn.png" },

  // Mythic (15000)
  { item_id: "skin_pr_cosmicseraph", category: "skin", name: "우주 천사", price: 15000, rarity: "Mythic", description: "은하의 힘을 품은 마스터피스, 우주 천사 스킨입니다.", image: "/images/assets/skins/pr_cosmicseraph.png" },
  { item_id: "skin_pr_celestialeye", category: "skin", name: "천상의 눈", price: 15000, rarity: "Mythic", description: "고대 룬 문자와 황금빛 고리로 휩싸인 신비로운 천상의 눈 스킨입니다.", image: "/images/assets/skins/pr_celestialeye.png" },
  { item_id: "skin_pr_galacticcore", category: "skin", name: "은하 핵", price: 15000, rarity: "Mythic", description: "초신성의 폭발력을 담은 거대한 은하 핵 스킨입니다.", image: "/images/assets/skins/pr_galacticcore.png" },
  { item_id: "skin_pr_cyberdemon", category: "skin", name: "사이버 데몬", price: 15000, rarity: "Mythic", description: "네온 케이블과 악마의 형상이 융합된 사이버 데몬 스킨입니다.", image: "/images/assets/skins/pr_cyberdemon.png" },
  { item_id: "skin_pr_chronoweaver", category: "skin", name: "시간의 직조자", price: 15000, rarity: "Mythic", description: "금빛 톱니바퀴로 시공간을 조종하는 시간의 직조자 스킨입니다.", image: "/images/assets/skins/pr_chronoweaver.png" },

  // ===================== AVATARS =====================
  // 등급별 기본 아바타 (requiredRole로 등급 기반 자동 소유)
  { item_id: "avatar_guest", category: "avatar", name: "게스트", price: 0, rarity: "Normal", description: "모든 사용자에게 기본 지급되는 게스트 아바타입니다.", image: "/avatars/avatar_guest.png", isDefault: true, requiredRole: "guest" },
  { item_id: "avatar_normal", category: "avatar", name: "노말 회원", price: 0, rarity: "Normal", description: "회원 가입 시 지급되는 노말 등급 아바타입니다.", image: "/avatars/avatar_normal.png", isDefault: true, requiredRole: "user" },
  { item_id: "avatar_premium", category: "avatar", name: "프리미엄 회원", price: 0, rarity: "Rare", description: "프리미엄 등급 달성 시 지급되는 특별 아바타입니다.", image: "/avatars/avatar_premium.png", isDefault: true, requiredRole: "premium" },
  { item_id: "avatar_admin", category: "avatar", name: "관리자", price: 0, rarity: "Legendary", description: "관리자 전용 아바타입니다.", image: "/avatars/avatar_admin.png", isDefault: true, requiredRole: "admin" },
  // Pets (500)
  { item_id: "avatar_pet_1", category: "avatar", name: "웰시코기 딜러", price: 500, rarity: "Normal", description: "딜러 보타이를 맨 귀여운 웰시코기 강아지입니다.", image: "/avatars/pet_corgi.png" },
  { item_id: "avatar_pet_2", category: "avatar", name: "턱시도 냥이", price: 500, rarity: "Normal", description: "카지노 칩을 굴리며 노는 도도한 고양이입니다.", image: "/avatars/pet_cat.png" },
  { item_id: "avatar_pet_3", category: "avatar", name: "행운의 토끼", price: 500, rarity: "Normal", description: "네잎클로버를 품은 행운의 토끼입니다.", image: "/avatars/pet_rabbit.png" },
  { item_id: "avatar_pet_4", category: "avatar", name: "룰렛 햄스터", price: 500, rarity: "Normal", description: "쳇바퀴 대신 룰렛을 도는 귀여운 햄스터입니다.", image: "/avatars/pet_hamster.png" },
  { item_id: "avatar_pet_5", category: "avatar", name: "골드 헌터 여우", price: 500, rarity: "Normal", description: "황금 코인을 모으는 숲속의 영리한 여우입니다.", image: "/avatars/pet_fox.png" },
  { item_id: "avatar_pet_6", category: "avatar", name: "모노클 부엉이", price: 500, rarity: "Normal", description: "모노클을 쓴 똑똑하고 점잖은 부엉이 딜러입니다.", image: "/avatars/pet_owl.png" },
  { item_id: "avatar_lego_1", category: "avatar", name: "블록 기사", price: 1000, rarity: "Rare", description: "칩 방패를 든 귀여운 장난감 기사 피규어입니다.", image: "/avatars/lego_knight.png" },
  { item_id: "avatar_lego_2", category: "avatar", name: "블록 해적", price: 1000, rarity: "Rare", description: "금화 더미 위에 선 장난감 해적 피규어입니다.", image: "/avatars/lego_pirate.png" },
  { item_id: "avatar_lego_3", category: "avatar", name: "블록 우주인", price: 1000, rarity: "Rare", description: "무중력 카지노를 탐험하는 우주인 피규어입니다.", image: "/avatars/lego_astronaut.png" },
  { item_id: "avatar_lego_4", category: "avatar", name: "블록 닌자", price: 1000, rarity: "Rare", description: "주사위를 무기처럼 다루는 장난감 닌자입니다.", image: "/avatars/lego_ninja.png" },
  { item_id: "avatar_lego_5", category: "avatar", name: "블록 카우보이", price: 1000, rarity: "Rare", description: "룰렛을 돌리는 멋진 장난감 카우보이입니다.", image: "/avatars/lego_cowboy.png" },
  { item_id: "avatar_lego_6", category: "avatar", name: "블록 킹", price: 1000, rarity: "Rare", description: "칩 왕좌에 앉은 위엄있는 장난감 왕입니다.", image: "/avatars/lego_king.png" },
  { item_id: "avatar_lego_7", category: "avatar", name: "블록 퀸", price: 1000, rarity: "Rare", description: "로얄 플러시를 쥔 우아한 장난감 여왕입니다.", image: "/avatars/lego_queen.png" },
  { item_id: "avatar_lego_8", category: "avatar", name: "블록 경찰", price: 1000, rarity: "Rare", description: "카지노 금고를 지키는 든든한 경찰 피규어입니다.", image: "/avatars/lego_police.png" },
  { item_id: "avatar_lego_9", category: "avatar", name: "블록 요리사", price: 1000, rarity: "Rare", description: "포커 칩을 요리하는 귀여운 셰프 피규어입니다.", image: "/avatars/lego_chef.png" },
  { item_id: "avatar_lego_10", category: "avatar", name: "블록 로봇", price: 1000, rarity: "Rare", description: "카드를 섞는 장난감 로봇 피규어입니다.", image: "/avatars/lego_robot.png" },
  { item_id: "avatar_clay_1", category: "avatar", name: "스마일 주사위", price: 1000, rarity: "Rare", description: "방긋 웃는 붉은색 점토 주사위입니다.", image: "/avatars/clay_dice.png" },
  { item_id: "avatar_clay_2", category: "avatar", name: "통통 포커칩", price: 1000, rarity: "Rare", description: "포동포동한 볼살의 점토 포커 칩입니다.", image: "/avatars/clay_chip.png" },
  { item_id: "avatar_clay_3", category: "avatar", name: "미니 슬롯", price: 1000, rarity: "Rare", description: "크고 귀여운 눈을 가진 미니 점토 슬롯머신입니다.", image: "/avatars/clay_slot.png" },
  { item_id: "avatar_clay_4", category: "avatar", name: "미니 룰렛", price: 1000, rarity: "Rare", description: "아기자기한 장난감 같은 점토 룰렛 휠입니다.", image: "/avatars/clay_roulette.png" },
  { item_id: "avatar_clay_5", category: "avatar", name: "워킹 트럼프", price: 1000, rarity: "Rare", description: "팔다리가 달린 장난꾸러기 점토 플레잉 카드입니다.", image: "/avatars/clay_card.png" },
  { item_id: "avatar_clay_6", category: "avatar", name: "윙크 편자", price: 1000, rarity: "Rare", description: "행운을 부르는 황금 점토 말발굽입니다.", image: "/avatars/clay_horseshoe.png" },
  { item_id: "avatar_royal_1", category: "avatar", name: "스페이드 킹", price: 3000, rarity: "Epic", description: "거대한 왕관을 쓴 근엄한 스페이드 왕국 꼬마 왕입니다.", image: "/avatars/royal_king.png" },
  { item_id: "avatar_royal_2", category: "avatar", name: "하트 퀸", price: 3000, rarity: "Epic", description: "하트 요술봉을 든 우아한 꼬마 여왕입니다.", image: "/avatars/royal_queen.png" },
  { item_id: "avatar_royal_3", category: "avatar", name: "다이아몬드 잭", price: 3000, rarity: "Epic", description: "창을 든 늠름한 다이아몬드 기사 꼬마입니다.", image: "/avatars/royal_jack.png" },
  { item_id: "avatar_royal_4", category: "avatar", name: "클로버 조커", price: 3000, rarity: "Epic", description: "다채로운 옷을 입고 익살스럽게 웃는 꼬마 조커입니다.", image: "/avatars/royal_joker.png" },
  { item_id: "avatar_royal_5", category: "avatar", name: "에이스 대천사", price: 3000, rarity: "Epic", description: "빛나는 에이스 문양을 수호하는 꼬마 천사입니다.", image: "/avatars/royal_ace.png" },
  { item_id: "avatar_alien_1", category: "avatar", name: "선글라스 에일리언", price: 7000, rarity: "Legendary", description: "선글라스를 낀 힙한 클래식 외계인입니다.", image: "/avatars/alien_green.png" },
  { item_id: "avatar_alien_2", category: "avatar", name: "문어발 에일리언", price: 7000, rarity: "Legendary", description: "여러 개의 보라색 촉수로 카드를 섞는 외계인입니다.", image: "/avatars/alien_tentacle.png" },
  { item_id: "avatar_alien_3", category: "avatar", name: "사이보그 에일리언", price: 7000, rarity: "Legendary", description: "기계 부품과 결합된 귀여운 사이보그 외계인입니다.", image: "/avatars/alien_cyborg.png" },
  { item_id: "avatar_alien_4", category: "avatar", name: "사이클롭스 몬스터", price: 7000, rarity: "Legendary", description: "커다란 눈 하나로 상대를 압도하는 귀여운 외계인입니다.", image: "/avatars/alien_cyclops.png" },
  { item_id: "avatar_alien_5", category: "avatar", name: "지니어스 브레인", price: 7000, rarity: "Legendary", description: "유리 돔 안에 든 천재 두뇌 외계인입니다.", image: "/avatars/alien_brain.png" },
  { item_id: "avatar_dealer_1", category: "avatar", name: "펭귄 딜러", price: 7000, rarity: "Legendary", description: "말끔한 정장 차림의 신사적인 펭귄 딜러입니다.", image: "/avatars/dealer_penguin.png" },
  { item_id: "avatar_dealer_2", category: "avatar", name: "AI 홀로그램 딜러", price: 7000, rarity: "Legendary", description: "홀로그램 눈빛으로 승률을 계산하는 로봇 딜러입니다.", image: "/avatars/dealer_robot.png" },
  { item_id: "avatar_dealer_3", category: "avatar", name: "크라켄 딜러", price: 7000, rarity: "Legendary", description: "8개의 다리로 눈보다 빠르게 카드를 섞는 문어입니다.", image: "/avatars/dealer_octopus.png" },
  { item_id: "avatar_dealer_4", category: "avatar", name: "팬텀 딜러", price: 7000, rarity: "Legendary", description: "테이블 위를 떠다니며 게임을 주도하는 유령 딜러입니다.", image: "/avatars/dealer_ghost.png" },
  { item_id: "avatar_dealer_5", category: "avatar", name: "몽키 딜러", price: 7000, rarity: "Legendary", description: "바나나 칩을 건네며 환하게 웃는 원숭이 딜러입니다.", image: "/avatars/dealer_monkey.png" },
  { item_id: "avatar_dealer_6", category: "avatar", name: "드래곤 딜러", price: 7000, rarity: "Legendary", description: "승리자에게 앙증맞은 불꽃을 뿜어주는 아기 드래곤입니다.", image: "/avatars/dealer_dragon.png" },
  { item_id: "avatar_skull_1", category: "avatar", name: "블러드 해커 스컬", price: 10000, rarity: "Mythic", description: "붉은 네온 에너지를 뿜어내는 어둠의 해커 스컬입니다.", image: "/avatars/skull_red.png" },
  { item_id: "avatar_skull_2", category: "avatar", name: "코어 데이터 스컬", price: 10000, rarity: "Mythic", description: "푸른색 홀로그램 데이터 스트림을 다루는 사이보그 스컬입니다.", image: "/avatars/skull_blue.png" },
  { item_id: "avatar_skull_3", category: "avatar", name: "매트릭스 스컬", price: 10000, rarity: "Mythic", description: "치명적인 녹색 네온과 매트릭스 코드가 흐르는 스컬입니다.", image: "/avatars/skull_green.png" },
  { item_id: "avatar_skull_4", category: "avatar", name: "팬텀 아우라 스컬", price: 10000, rarity: "Mythic", description: "보라색 영혼의 불꽃을 두르고 있는 신비로운 팬텀 스컬입니다.", image: "/avatars/skull_purple.png" },
  { item_id: "avatar_skull_5", category: "avatar", name: "골든 엠퍼러 스컬", price: 10000, rarity: "Mythic", description: "카지노의 제왕임을 증명하는 눈부신 순금 마스크 스컬입니다.", image: "/avatars/skull_gold.png" },

  // ===================== BORDERS =====================
  // Normal (500)
  { item_id: "border_n_silver", category: "border", name: "실버 링", price: 500, rarity: "Normal", description: "깔끔하고 세련된 은빛 테두리입니다.", image: "" },
  { item_id: "border_n_bronze", category: "border", name: "브론즈 기어", price: 500, rarity: "Normal", description: "단단한 청동으로 만들어진 테두리입니다.", image: "" },
  { item_id: "border_n_wood", category: "border", name: "오크 우드", price: 500, rarity: "Normal", description: "따뜻한 느낌을 주는 참나무 테두리입니다.", image: "" },
  { item_id: "border_n_stone", category: "border", name: "조약돌", price: 500, rarity: "Normal", description: "단단하고 묵직한 돌 테두리입니다.", image: "" },
  { item_id: "border_n_leather", category: "border", name: "스티치 가죽", price: 500, rarity: "Normal", description: "장인의 솜씨가 깃든 가죽 테두리입니다.", image: "" },

  // Rare (1000)
  { item_id: "border_r_neon_blue", category: "border", name: "네온 블루", price: 1000, rarity: "Rare", description: "차가운 푸른빛이 감도는 네온 테두리입니다.", image: "" },
  { item_id: "border_r_neon_pink", category: "border", name: "네온 핑크", price: 1000, rarity: "Rare", description: "화려한 핑크빛 네온 테두리입니다.", image: "" },
  { item_id: "border_r_golden_wire", category: "border", name: "골든 와이어", price: 1000, rarity: "Rare", description: "정교하게 꼬아 만든 금빛 철사 테두리입니다.", image: "" },
  { item_id: "border_r_holo", category: "border", name: "홀로그램 글래스", price: 1000, rarity: "Rare", description: "빛의 각도에 따라 색이 변하는 테두리입니다.", image: "" },
  { item_id: "border_r_firefly", category: "border", name: "반딧불이 숲", price: 1000, rarity: "Rare", description: "작은 빛무리들이 떠도는 평화로운 테두리입니다.", image: "" },

  // Epic (2000) - Premium Only
  { item_id: "border_e_plasma", category: "border", name: "플라즈마 코어", price: 2000, rarity: "Epic", description: "고밀도 에너지가 방출되는 플라즈마 테두리입니다.", image: "", requiresPremium: true },
  { item_id: "border_e_cyber_circuit", category: "border", name: "사이버 회로", price: 2000, rarity: "Epic", description: "데이터가 끊임없이 흐르는 전자 회로 테두리입니다.", image: "", requiresPremium: true },
  { item_id: "border_e_lava_flow", category: "border", name: "흐르는 용암", price: 2000, rarity: "Epic", description: "뜨거운 용암이 역동적으로 흐르는 테두리입니다.", image: "", requiresPremium: true },
  { item_id: "border_e_toxic_spill", category: "border", name: "맹독 방사능", price: 2000, rarity: "Epic", description: "위험한 녹색 형광 물질이 뿜어져 나오는 테두리입니다.", image: "", requiresPremium: true },
  { item_id: "border_e_galaxy_spin", category: "border", name: "스파이럴 은하", price: 2000, rarity: "Epic", description: "별빛이 소용돌이치는 신비로운 은하수 테두리입니다.", image: "", requiresPremium: true },

  // Legendary (3000) - Premium Only
  { item_id: "border_l_dragon_scale", category: "border", name: "드래곤 스케일", price: 3000, rarity: "Legendary", description: "용의 숨결을 품은 붉은 비늘 테두리입니다.", image: "", requiresPremium: true },
  { item_id: "border_l_phoenix_flame", category: "border", name: "불사조의 불꽃", price: 3000, rarity: "Legendary", description: "영원히 꺼지지 않는 성스러운 불꽃 테두리입니다.", image: "", requiresPremium: true },
  { item_id: "border_l_void_abyss", category: "border", name: "공허의 심연", price: 3000, rarity: "Legendary", description: "빛조차 삼켜버리는 끝없는 심연의 테두리입니다.", image: "", requiresPremium: true },

  // Mythic (5000) - Premium Only
  { item_id: "border_m_god_halo", category: "border", name: "신성한 후광", price: 5000, rarity: "Mythic", description: "절대자의 권위를 상징하는 눈부신 황금빛 후광입니다.", image: "", requiresPremium: true },
  { item_id: "border_m_matrix_glitch", category: "border", name: "매트릭스 글리치", price: 5000, rarity: "Mythic", description: "시공간에 균열을 일으키는 디지털 글리치 테두리입니다.", image: "", requiresPremium: true },
  { item_id: "border_m_time_warp", category: "border", name: "타임 워프", price: 5000, rarity: "Mythic", description: "시간의 흐름을 비틀어버리는 초현실적 테두리입니다.", image: "", requiresPremium: true },

  // ===================== PIECES (OBSTACLES) =====================
  // 기본 보유(무료)
  { item_id: "piece_pin", category: "piece", name: "핀", price: 0, rarity: "Normal", description: "공이 닿으면 튕겨내는 기본 원형 핀입니다.", image: "/images/assets/obstacles/obstacle_pin.png", isDefault: true },
  { item_id: "piece_bumper", category: "piece", name: "범퍼", price: 0, rarity: "Normal", description: "강하게 부딪힐수록 더 멀리 튕겨냅니다.", image: "/images/assets/obstacles/obstacle_bumper.png", isDefault: true },
  { item_id: "piece_booster", category: "piece", name: "부스터", price: 0, rarity: "Normal", description: "특정 방향으로 속도를 강하게 가속시킵니다.", image: "/images/assets/obstacles/obstacle_booster.png", isDefault: true },
  { item_id: "piece_hole", category: "piece", name: "구멍", price: 0, rarity: "Normal", description: "공이 빠질 수 있는 구멍입니다.", image: "/images/assets/obstacles/obstacle_hole.png", isDefault: true },
  { item_id: "piece_blackhole", category: "piece", name: "블랙홀", price: 0, rarity: "Normal", description: "공을 빨아들이는 블랙홀입니다.", image: "/images/assets/obstacles/obstacle_blackhole.png", isDefault: true },
  { item_id: "piece_whitehole", category: "piece", name: "화이트홀", price: 0, rarity: "Normal", description: "블랙홀에서 빨아들인 공을 뱉어냅니다.", image: "/images/assets/obstacles/obstacle_whitehole.png", isDefault: true },
  { item_id: "piece_iceblock", category: "piece", name: "얼음블록", price: 0, rarity: "Normal", description: "내구도가 닳아 결국 깨지는 블록입니다.", image: SVG_ASSETS.iceblock, iconName: "Box", isDefault: true },
  { item_id: "piece_polygon", category: "piece", name: "자유형 블록", price: 0, rarity: "Normal", description: "원하는 모양으로 만드는 블록입니다.", image: "", iconName: "CircleDashed", isDefault: true },
  { item_id: "piece_spinner", category: "piece", name: "스피너", price: 0, rarity: "Normal", description: "빠르게 회전하며 불규칙하게 튕겨냅니다.", image: SVG_ASSETS.spinner, iconName: "Loader", isDefault: true },
  { item_id: "piece_flipper", category: "piece", name: "플리퍼", price: 0, rarity: "Normal", description: "핀볼처럼 공을 강하게 쳐서 올려보냅니다.", image: SVG_ASSETS.flipper, iconName: "MoveDiagonal", isDefault: true },
  // 상점 판매
  { item_id: "piece_windmill", category: "piece", name: "풍차", price: 1000, rarity: "Rare", description: "일정 속도로 회전하며 경로를 방해합니다.", image: "/images/assets/obstacles/obstacle_windmill.png", requiresPremium: true },
  { item_id: "piece_piston", category: "piece", name: "피스톤", price: 1000, rarity: "Rare", description: "주기적으로 튀어나와 강제로 밀어냅니다.", image: "/images/assets/obstacles/obstacle_piston.png", requiresPremium: true },
  { item_id: "piece_windcannon", category: "piece", name: "송풍기", price: 2500, rarity: "Epic", description: "특정 방향으로 바람을 일으켜 밀어냅니다.", image: SVG_ASSETS.windcannon, requiresPremium: true },
  { item_id: "piece_portal", category: "piece", name: "포탈", price: 2500, rarity: "Epic", description: "진입한 공을 즉시 이동시킵니다.", image: "/images/assets/obstacles/obstacle_portal.png", requiresPremium: true },
  { item_id: "piece_luckygate", category: "piece", name: "럭키게이트", price: 5000, rarity: "Legendary", description: "점수나 효과를 부여하는 특수 게이트입니다.", image: SVG_ASSETS.luckygate, iconName: "Trophy", requiresPremium: true },
  { item_id: "piece_speedgate", category: "piece", name: "스피드게이트", price: 5000, rarity: "Legendary", description: "통과 시 이동 속도를 크게 증가시킵니다.", image: SVG_ASSETS.speedgate, iconName: "FastForward", requiresPremium: true },
  { item_id: "piece_slowgate", category: "piece", name: "슬로우게이트", price: 5000, rarity: "Legendary", description: "통과 시 이동 속도를 크게 감소시킵니다.", image: SVG_ASSETS.slowgate, iconName: "Rewind", requiresPremium: true },

  // ===================== FRAMES (Walls) =====================
  // 기본 보유
  { item_id: "frame_wall", category: "frame", name: "기본 벽", price: 0, rarity: "Normal", description: "맵의 외곽을 감싸는 기본적인 경계 벽입니다.", image: "/images/assets/obstacles/obstacle_wall.png", isDefault: true, requiresPremium: true },
  { item_id: "frame_circuit", category: "frame", name: "전자 기판", price: 0, rarity: "Normal", description: "회로가 흐르는 듯한 기판 형태의 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_circuit.png", isDefault: true, requiresPremium: true },
  { item_id: "frame_neon", category: "frame", name: "네온 사이버펑크", price: 0, rarity: "Normal", description: "화려한 네온 빛을 내는 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_neon.png", isDefault: true, requiresPremium: true },
  // 판매
  { item_id: "frame_grass", category: "frame", name: "잔디 숲", price: 1500, rarity: "Rare", description: "자연의 기운을 담은 잔디 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_grass.png", requiresPremium: true },
  { item_id: "frame_ice", category: "frame", name: "빙하 얼음", price: 1500, rarity: "Rare", description: "차가운 얼음 형태의 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_ice.png", requiresPremium: true },
  { item_id: "frame_toxic", category: "frame", name: "맹독 지대", price: 1500, rarity: "Rare", description: "오염된 맹독이 흐르는 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_toxic.png", requiresPremium: true },
  { item_id: "frame_lava", category: "frame", name: "용암 대장간", price: 1500, rarity: "Rare", description: "뜨거운 열기가 느껴지는 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_lava.png", requiresPremium: true },
  { item_id: "frame_candy", category: "frame", name: "캔디 랜드", price: 2500, rarity: "Epic", description: "달콤한 과자 모양의 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_candy.png", requiresPremium: true },
  { item_id: "frame_arcade", category: "frame", name: "레트로 아케이드", price: 2500, rarity: "Epic", description: "고전 게임 스타일의 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_arcade.png", requiresPremium: true },
  { item_id: "frame_matrix", category: "frame", name: "매트릭스", price: 2500, rarity: "Epic", description: "디지털 데이터가 흐르는 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_matrix.png", requiresPremium: true },
  { item_id: "frame_steampunk", category: "frame", name: "스팀펑크", price: 2500, rarity: "Epic", description: "톱니바퀴가 돌아가는 기계 장치 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_steampunk.png", requiresPremium: true },
  { item_id: "frame_crystal", category: "frame", name: "수정 동굴", price: 2500, rarity: "Epic", description: "빛나는 수정이 박힌 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_crystal.png", requiresPremium: true },
  { item_id: "frame_gothic", category: "frame", name: "고딕 호러", price: 4000, rarity: "Legendary", description: "으스스한 분위기의 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_gothic.png", requiresPremium: true },
  { item_id: "frame_space", category: "frame", name: "심우주", price: 4000, rarity: "Legendary", description: "우주의 신비로움을 담은 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_space.png", requiresPremium: true },
  { item_id: "frame_gold", category: "frame", name: "황금 신전", price: 4000, rarity: "Legendary", description: "고급스러운 황금빛 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_gold.png", requiresPremium: true },
  { item_id: "frame_plasma", category: "frame", name: "플라즈마 에너지", price: 8000, rarity: "Mythic", description: "에너지가 요동치는 벽입니다.", image: "/images/assets/obstacles/obstacle_wall_plasma.png", requiresPremium: true },

  // ===================== BACKGROUNDS =====================
  // 기본 보유
  { item_id: "bg_none", category: "background", name: "없음", price: 0, rarity: "Normal", description: "기본 빈 배경입니다.", image: "", isDefault: true, requiresPremium: true },
  { item_id: "bg_neon_arcade", category: "background", name: "네온 아케이드", price: 0, rarity: "Normal", description: "기본 제공 배경입니다.", image: "/images/assets/map_bg_neon_arcade.png", isDefault: true, requiresPremium: true },
  { item_id: "bg_gravity_abyss", category: "background", name: "블랙홀의 함정", price: 0, rarity: "Normal", description: "기본 제공 배경입니다.", image: "/images/assets/map_bg_gravity_abyss.png", isDefault: true, requiresPremium: true },
  { item_id: "bg_mechanical_factory", category: "background", name: "톱니바퀴 공장", price: 0, rarity: "Normal", description: "기본 제공 배경입니다.", image: "/images/assets/map_bg_mechanical_factory.png", isDefault: true, requiresPremium: true },
  { item_id: "bg_boost_highway", category: "background", name: "부스트 하이웨이", price: 0, rarity: "Normal", description: "기본 제공 배경입니다.", image: "/images/assets/map_bg_boost_highway.png", isDefault: true, requiresPremium: true },
  // 판매
  { item_id: "bg_portal_labyrinth", category: "background", name: "차원 포탈 미궁", price: 2000, rarity: "Rare", description: "신비로운 차원 문이 펼쳐진 배경입니다.", image: "/images/assets/map_bg_portal_labyrinth.png", requiresPremium: true },
  { item_id: "bg_plinko_cascade", category: "background", name: "플링코 폭포", price: 2000, rarity: "Rare", description: "구슬이 떨어지는 플링코 폭포입니다.", image: "/images/assets/map_bg_plinko_cascade.png", requiresPremium: true },
  { item_id: "bg_roulette_of_fate", category: "background", name: "운명의 룰렛", price: 2000, rarity: "Rare", description: "행운을 가늠하는 룰렛 배경입니다.", image: "/images/assets/map_bg_roulette_of_fate.png", requiresPremium: true },
  { item_id: "bg_tornado_canyon", category: "background", name: "토네이도 협곡", price: 2000, rarity: "Rare", description: "바람이 거세게 부는 계곡입니다.", image: "/images/assets/map_bg_tornado_canyon.png", requiresPremium: true },
  { item_id: "bg_bounce_mirror", category: "background", name: "혼돈의 거울", price: 2000, rarity: "Rare", description: "거울의 방을 닮은 배경입니다.", image: "/images/assets/map_bg_bounce_mirror.png", requiresPremium: true },
  { item_id: "bg_meteor_field", category: "background", name: "미티어 필드", price: 2000, rarity: "Rare", description: "운석이 떨어지는 우주 전장입니다.", image: "/images/assets/map_bg_meteor_field.png", requiresPremium: true },
  { item_id: "bg_enchanted_forest", category: "background", name: "요정의 숲", price: 2000, rarity: "Rare", description: "요정들이 춤추는 신비한 숲입니다.", image: "/images/assets/bg_enchanted_forest_1782785674317.jpg", requiresPremium: true },
  { item_id: "bg_desert_oasis", category: "background", name: "사막 오아시스", price: 2000, rarity: "Rare", description: "건조한 사막 한가운데의 오아시스입니다.", image: "/images/assets/bg_desert_oasis_1782785682635.jpg", requiresPremium: true },
  { item_id: "bg_icy_glacier_cavern", category: "background", name: "빙하 동굴", price: 2000, rarity: "Rare", description: "차갑고 웅장한 빙하 동굴입니다.", image: "/images/assets/bg_icy_glacier_cavern_1782785635405.jpg", requiresPremium: true },
  { item_id: "bg_lava_volcano_core", category: "background", name: "용암 지대", price: 2000, rarity: "Rare", description: "펄펄 끓는 용암이 흐르는 화산입니다.", image: "/images/assets/bg_lava_volcano_core_1782785625035.jpg", requiresPremium: true },
  
  { item_id: "bg_cyberpunk_megacity", category: "background", name: "사이버펑크 시티", price: 4000, rarity: "Epic", description: "미래 도시의 화려한 야경입니다.", image: "/images/assets/bg_cyberpunk_megacity_1782785606020.jpg", requiresPremium: true },
  { item_id: "bg_virtual_matrix_grid", category: "background", name: "가상 매트릭스", price: 4000, rarity: "Epic", description: "데이터가 흐르는 가상 매트릭스 공간입니다.", image: "/images/assets/bg_virtual_matrix_grid_1782785744588.jpg", requiresPremium: true },
  { item_id: "bg_toxic_wasteland", category: "background", name: "오염 구역", price: 4000, rarity: "Epic", description: "위험한 화학물질로 오염된 구역입니다.", image: "/images/assets/bg_toxic_wasteland_1782785654564.jpg", requiresPremium: true },
  { item_id: "bg_candy_land", category: "background", name: "캔디 랜드", price: 4000, rarity: "Epic", description: "달콤한 과자로 만들어진 세상입니다.", image: "/images/assets/bg_candy_land_1782785710474.jpg", requiresPremium: true },
  { item_id: "bg_cyber_dystopia", category: "background", name: "사이버 디스토피아", price: 4000, rarity: "Epic", description: "사이버네틱한 절망의 도시입니다.", image: "/images/assets/bg_cyber_dystopia.png", requiresPremium: true },
  { item_id: "bg_neon_synthwave_ultra", category: "background", name: "네온 신스웨이브", price: 4000, rarity: "Epic", description: "레트로 퓨처리즘 감성의 배경입니다.", image: "/images/assets/bg_neon_synthwave_ultra.png", requiresPremium: true },
  { item_id: "bg_retrowave_sunset", category: "background", name: "레트로 선셋", price: 4000, rarity: "Epic", description: "아름다운 노을을 배경으로 한 레트로 풍경입니다.", image: "/images/assets/bg_retrowave_sunset_1782785719122.jpg", requiresPremium: true },
  { item_id: "bg_steampunk_factory", category: "background", name: "스팀펑크 공장", price: 4000, rarity: "Epic", description: "증기와 기계가 맞물려 돌아가는 공장입니다.", image: "/images/assets/bg_steampunk_factory_1782785664737.jpg", requiresPremium: true },
  { item_id: "bg_frozen_tundra", category: "background", name: "혹한의 툰드라", price: 4000, rarity: "Epic", description: "얼어붙은 차가운 설원입니다.", image: "/images/assets/bg_frozen_tundra_1782785823149.jpg", requiresPremium: true },
  { item_id: "bg_galactic_highway", category: "background", name: "은하계 도로", price: 4000, rarity: "Epic", description: "별빛 사이를 관통하는 우주 하이웨이입니다.", image: "/images/assets/bg_galactic_highway_1782785832121.jpg", requiresPremium: true },

  { item_id: "bg_deep_space_nebula", category: "background", name: "심우주 성운", price: 8000, rarity: "Legendary", description: "신비로운 우주의 성운입니다.", image: "/images/assets/bg_deep_space_nebula_1782785644285.jpg", requiresPremium: true },
  { item_id: "bg_haunted_gothic_castle", category: "background", name: "고딕 성", price: 8000, rarity: "Legendary", description: "어둠에 잠긴 무서운 뱀파이어 성입니다.", image: "/images/assets/bg_haunted_gothic_castle_1782785727034.jpg", requiresPremium: true },
  { item_id: "bg_celestial_clockwork", category: "background", name: "천체 시계장치", price: 8000, rarity: "Legendary", description: "우주의 시간을 관장하는 시계 장치입니다.", image: "/images/assets/bg_celestial_clockwork.png", requiresPremium: true },
  { item_id: "bg_pirate_ship_deck", category: "background", name: "해적선 갑판", price: 8000, rarity: "Legendary", description: "거친 파도를 항해하는 해적선 갑판입니다.", image: "/images/assets/bg_pirate_ship_deck_1782785840910.jpg", requiresPremium: true },
  { item_id: "bg_samurai_dojo", category: "background", name: "사무라이 도장", price: 8000, rarity: "Legendary", description: "벚꽃이 흩날리는 무사의 도장입니다.", image: "/images/assets/bg_samurai_dojo_1782785850135.jpg", requiresPremium: true },
  { item_id: "bg_abyssal_trench", category: "background", name: "심해 해구", price: 8000, rarity: "Legendary", description: "아무것도 보이지 않는 심해 깊은 곳입니다.", image: "/images/assets/bg_abyssal_trench.png", requiresPremium: true },
  { item_id: "bg_quantum_realm_178", category: "background", name: "양자 영역", price: 8000, rarity: "Legendary", description: "미시 세계의 복잡하고 신비로운 양자 영역입니다.", image: "/images/assets/bg_quantum_realm_1782785877783.jpg", requiresPremium: true },
  { item_id: "bg_post_apocalyptic_ruins", category: "background", name: "아포칼립스", price: 8000, rarity: "Legendary", description: "멸망 이후의 쓸쓸한 폐허입니다.", image: "/images/assets/bg_post_apocalyptic_ruins_1782785753197.jpg", requiresPremium: true },

  { item_id: "bg_golden_temple", category: "background", name: "황금 신전", price: 15000, rarity: "Mythic", description: "황금으로 덮여 반짝이는 신전입니다.", image: "/images/assets/bg_golden_temple_1782785887745.jpg", requiresPremium: true },
  { item_id: "bg_celestial_sky_palace", category: "background", name: "천상의 궁전", price: 15000, rarity: "Mythic", description: "구름 위에 떠 있는 신들의 궁전입니다.", image: "/images/assets/bg_celestial_sky_palace_1782785761515.jpg", requiresPremium: true },
  { item_id: "bg_bioluminescent_jungle", category: "background", name: "생물발광 정글", price: 15000, rarity: "Mythic", description: "빛을 내는 식물들로 가득한 정글입니다.", image: "/images/assets/bg_bioluminescent_jungle_1782785780805.jpg", requiresPremium: true },
  { item_id: "bg_abstract_geometric_void", category: "background", name: "기하학적 추상", price: 15000, rarity: "Mythic", description: "규칙적이고 추상적인 기하학 공간입니다.", image: "/images/assets/bg_abstract_geometric_void_1782785788732.jpg", requiresPremium: true },
  { item_id: "bg_floating_islands", category: "background", name: "부유하는 섬", price: 15000, rarity: "Mythic", description: "하늘에 둥둥 떠있는 섬들입니다.", image: "/images/assets/bg_floating_islands_1782785867391.jpg", requiresPremium: true },
  { item_id: "bg_ancient_mystic_ruins", category: "background", name: "고대 유적", price: 15000, rarity: "Mythic", description: "잊혀진 문명의 신비로운 유적지입니다.", image: "/images/assets/bg_ancient_mystic_ruins_1782785615064.jpg", requiresPremium: true },
  { item_id: "bg_alien_planet_surface", category: "background", name: "외계 행성", price: 15000, rarity: "Mythic", description: "미지의 생명체가 살 법한 외계 행성입니다.", image: "/images/assets/bg_alien_planet_surface_1782785858731.jpg", requiresPremium: true },

];
