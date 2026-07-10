// profiles.settings JSONB에 저장되는 사용자 환경설정
// (SettingsModal에서 저장, GlobalPlayerHUD 로그인 시 하이드레이션)
export interface UserSettings {
  gimmickDensity?: number;
  baseTimeScale?: number;
  comebackStrength?: number;
  playTime?: number;
  isScreenShakeEnabled?: boolean;
  calmMode?: boolean;
  theme?: 'dark' | 'light';
  fontFamily?: string;
  bgmVolume?: number;
  sfxVolume?: number;
}

export interface UserProfile {
  id: string;
  email?: string | null;
  username: string | null;
  name: string | null;
  role: 'user' | 'premium' | 'admin' | 'guest';
  chips_balance: number;
  total_games_played: number;
  login_count: number;
  avatar_id?: string | null;
  achievements_completed?: number;
  total_achievements?: number;
  settings?: UserSettings | null;
  created_at: string;
  updated_at: string;
}
