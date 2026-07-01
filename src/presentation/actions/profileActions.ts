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
    return profile as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}
