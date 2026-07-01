export interface UserProfile {
  id: string;
  username: string | null;
  name: string | null;
  role: 'user' | 'premium' | 'admin';
  chips_balance: number;
  total_games_played: number;
  login_count: number;
  created_at: string;
  updated_at: string;
}
