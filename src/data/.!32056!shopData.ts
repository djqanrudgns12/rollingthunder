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
}

export const MOCK_ITEMS: ShopItem[] = [
  // ===================== SKINS =====================
  // Default (0)
  { item_id: "skin_chip_base", category: "skin", name: "포커칩", price: 0, rarity: "Normal", description: "기본 지급되는 포커칩 스킨입니다.", image: "", iconName: "Circle", isDefault: true },
  { item_id: "horse", category: "skin", name: "경주마", price: 0, rarity: "Normal", description: "기본 지급되는 경주마 스킨입니다.", image: "", iconName: "Zap", isDefault: true },
  { item_id: "spaceship", category: "skin", name: "우주선", price: 0, rarity: "Normal", description: "기본 지급되는 우주선 스킨입니다.", image: "", iconName: "Rocket", isDefault: true },

  // Normal (300 ~ 500)
  { item_id: "skin_shuriken", category: "skin", name: "표창", price: 300, rarity: "Normal", description: "날렵한 표창 스킨입니다.", image: "/images/assets/skins/shuriken.png" },
  { item_id: "skin_car", category: "skin", name: "스포츠카", price: 400, rarity: "Normal", description: "빠르게 질주하는 스포츠카 스킨입니다.", image: "/images/assets/skins/car.png" },
  { item_id: "skin_cat", category: "skin", name: "고양이", price: 500, rarity: "Normal", description: "귀여운 고양이 스킨입니다.", image: "/images/assets/skins/cat.png" },
  { item_id: "skin_blackhole", category: "skin", name: "블랙홀", price: 500, rarity: "Normal", description: "모든 것을 빨아들이는 블랙홀 스킨입니다.", image: "/images/assets/skins/blackhole.png" },
  
  // Rare (1000)
  { item_id: "skin_pr_alien", category: "skin", name: "에일리언", price: 1000, rarity: "Rare", description: "외계 생명체 에일리언 스킨입니다.", image: "/images/assets/skins/pr_alien.png" },
  { item_id: "skin_pr_ghost", category: "skin", name: "유령", price: 1000, rarity: "Rare", description: "벽을 통과하는 유령 스킨입니다.", image: "/images/assets/skins/pr_ghost.png" },
  { item_id: "skin_pr_slime", category: "skin", name: "슬라임", price: 1000, rarity: "Rare", description: "말랑말랑한 슬라임 스킨입니다.", image: "/images/assets/skins/pr_slime.png" },
  { item_id: "skin_pr_gummy", category: "skin", name: "구미베어", price: 1000, rarity: "Rare", description: "달콤한 구미베어 스킨입니다.", image: "/images/assets/skins/pr_gummy.png" },
  { item_id: "skin_pr_hamster", category: "skin", name: "햄스터", price: 1000, rarity: "Rare", description: "귀여운 햄스터 스킨입니다.", image: "/images/assets/skins/pr_hamster.png" },
  
  // Epic (2500)
  { item_id: "skin_pr_astronaut", category: "skin", name: "우주비행사", price: 2500, rarity: "Epic", description: "우주를 유영하는 우주비행사 스킨입니다.", image: "/images/assets/skins/pr_astronaut.png" },
  { item_id: "skin_pr_dino", category: "skin", name: "공룡", price: 2500, rarity: "Epic", description: "선사시대 공룡 스킨입니다.", image: "/images/assets/skins/pr_dino.png" },
  { item_id: "skin_pr_hotairballoon", category: "skin", name: "열기구", price: 2500, rarity: "Epic", description: "하늘을 나는 열기구 스킨입니다.", image: "/images/assets/skins/pr_hotairballoon.png" },
  { item_id: "skin_pr_pirateship", category: "skin", name: "해적선", price: 2500, rarity: "Epic", description: "바다를 누비는 해적선 스킨입니다.", image: "/images/assets/skins/pr_pirateship.png" },
  { item_id: "skin_pr_robot", category: "skin", name: "로봇", price: 2500, rarity: "Epic", description: "미래형 로봇 스킨입니다.", image: "/images/assets/skins/pr_robot.png" },
  
  // Legendary (5000)
  { item_id: "skin_pr_dragon", category: "skin", name: "드래곤", price: 5000, rarity: "Legendary", description: "불을 뿜는 전설의 드래곤 스킨입니다.", image: "/images/assets/skins/pr_dragon.png" },
  { item_id: "skin_pr_magiccarpet", category: "skin", name: "마법 양탄자", price: 5000, rarity: "Legendary", description: "하늘을 나는 마법 양탄자 스킨입니다.", image: "/images/assets/skins/pr_magiccarpet.png" },
  { item_id: "skin_pr_phoenix", category: "skin", name: "불사조", price: 5000, rarity: "Legendary", description: "영원히 타오르는 불사조 스킨입니다.", image: "/images/assets/skins/pr_phoenix.png" },
  { item_id: "skin_pr_unicorn", category: "skin", name: "유니콘", price: 5000, rarity: "Legendary", description: "환상 속의 유니콘 스킨입니다.", image: "/images/assets/skins/pr_unicorn.png" },

  // ===================== AVATARS =====================
  // Default (0)
