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

    // 매 내비게이션마다 실행되는 경로 — 독립 쿼리 2건을 병렬화해 왕복 1회분 단축
    const [profile, stats] = await Promise.all([
      UserRepository.getProfile(user.id),
      UserRepository.getProfileStats(user.id),
    ]);

    return {
      ...profile,
      email: user.email,
      chips_balance: Number(profile.chips ?? profile.chips_balance ?? 0),
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

export async function updateSettingsAction(settings: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ settings })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating settings:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in updateSettingsAction:', error);
    return { success: false, error: error.message };
  }
}
