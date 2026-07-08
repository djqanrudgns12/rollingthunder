import { createClient } from '@/lib/supabase/server';
import { UserMapEntity } from '@/core/entities/UserMap';
import { UserMapRepository, StoreSort } from '@/infrastructure/supabase/userMapRepository';
import { AuthenticationError } from '@/core/errors/AppError';

/** 커스텀 맵 스토어 목록 — 모든 로그인 유저 열람 가능 */
export class GetStoreMapsUseCase {
  static async execute(options?: { sort?: StoreSort; limit?: number }): Promise<UserMapEntity[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError('맵 스토어는 로그인 후 이용할 수 있습니다.');
    }

    return UserMapRepository.findPublished({
      sort: options?.sort ?? 'popular',
      limit: options?.limit,
    });
  }
}
