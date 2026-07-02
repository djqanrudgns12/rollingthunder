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

  static async getProfileStats(userId: string): Promise<{ total_achievements: number, achievements_completed: number }> {
    const supabase = await createClient();
    
    // 전체 업적 개수 (achievement, hidden)
    const { count: total_achievements } = await supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .in('type', ['achievement', 'hidden']);

    // 완료한 업적 개수
    const { count: achievements_completed } = await supabase
      .from('user_achievements')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true);

    return {
      total_achievements: total_achievements || 0,
      achievements_completed: achievements_completed || 0
    };
  }
}
