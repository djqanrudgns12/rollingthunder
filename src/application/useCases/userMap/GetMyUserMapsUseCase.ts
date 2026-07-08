import { createClient } from '@/lib/supabase/server';
import { UserMapEntity } from '@/core/entities/UserMap';
import { UserMapRepository } from '@/infrastructure/supabase/userMapRepository';
import { AuthenticationError } from '@/core/errors/AppError';

/** 내가 만든 개인 커스텀 맵 목록 (에디터 '내 맵' 아코디언, 맵 로드 모달) */
export class GetMyUserMapsUseCase {
  static async execute(): Promise<UserMapEntity[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError('로그인이 필요합니다.');
    }

    return UserMapRepository.findByOwner(user.id);
  }
}
