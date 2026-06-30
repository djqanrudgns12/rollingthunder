'use server';

import { createClient } from '@/lib/supabase/server';
import { UserRepository } from '@/infrastructure/supabase/userRepository';

export async function getUserRoleAction(): Promise<{ role: string | null }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { role: null };
    }

    const role = await UserRepository.getUserRole(user.id);
    return { role };
  } catch (error) {
    console.error('Error fetching user role:', error);
    return { role: null };
  }
}
