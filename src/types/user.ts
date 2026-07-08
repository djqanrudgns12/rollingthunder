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
  created_at: string;
  updated_at: string;
}
