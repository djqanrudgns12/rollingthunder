import { createClient } from '@/lib/supabase/server';
import { DatabaseError } from '@/core/errors/AppError';

export class UserRepository {
  static async getUserRole(userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new DatabaseError(`프로필 조회 중 오류가 발생했습니다: ${error.message}`);
    }

    return data?.role || null;
  }

  static async getProfile(userId: string): Promise<any | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new DatabaseError(`프로필 조회 중 오류가 발생했습니다: ${error.message}`);
    }

    return data;
  }
}
