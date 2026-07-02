'use server'

import { createClient } from '@/lib/supabase/server';
import { UserRepository } from '@/infrastructure/supabase/userRepository';
import { UserProfile } from '@/types/user';

export async function getProfileOverviewAction(): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const profile = await UserRepository.getProfile(user.id);
    const stats = await UserRepository.getProfileStats(user.id);

    return {
      ...profile,
      chips_balance: Number(profile.chips_balance ?? 0),
      total_games_played: Number(profile.total_games_played ?? 0),
      login_count: Number(profile.login_count ?? 0),
      total_achievements: stats.total_achievements,
      achievements_completed: stats.achievements_completed
    } as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}
