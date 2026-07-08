import { createClient } from '@/lib/supabase/server';
import { UserMapDownloadEntity } from '@/core/entities/UserMap';
import { UserMapRepository } from '@/infrastructure/supabase/userMapRepository';
import { AuthenticationError } from '@/core/errors/AppError';

/** 내가 다운로드한 맵 목록 (스냅샷 포함 — 원본 삭제와 무관하게 플레이 가능) */
export class GetMyDownloadsUseCase {
  static async execute(): Promise<UserMapDownloadEntity[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError('로그인이 필요합니다.');
    }

    return UserMapRepository.findDownloads(user.id);
  }
}
