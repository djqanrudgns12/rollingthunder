import { createClient } from '@/lib/supabase/server';
import { UserMapRepository } from '@/infrastructure/supabase/userMapRepository';
import { AuthenticationError, PermissionDeniedError, ValidationError } from '@/core/errors/AppError';

/**
 * 개인 커스텀 맵 삭제. 배포된 맵이었어도 다운로더는 스냅샷으로 계속 플레이 가능.
 */
export class DeleteUserMapUseCase {
  static async execute(mapId: string): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError('로그인이 필요합니다.');
    }

    const map = await UserMapRepository.findById(mapId);
    if (!map) {
      throw new ValidationError('삭제할 맵을 찾을 수 없습니다.');
    }
    if (map.ownerId !== user.id) {
      throw new PermissionDeniedError('본인이 만든 맵만 삭제할 수 있습니다.');
    }

    await UserMapRepository.delete(mapId, user.id);
  }
}
