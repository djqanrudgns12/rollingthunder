import { createClient } from '@/lib/supabase/server';
import { UserMapRepository } from '@/infrastructure/supabase/userMapRepository';
import { AuthenticationError } from '@/core/errors/AppError';

/**
 * 스토어 맵 다운로드.
 * 과금/보상은 download_user_map RPC 가 원자적으로 처리:
 * 최초 다운로드 && 비소유자 → 다운로더 100칩 차감 + 제작자 100칩 지급 (칩 이전).
 * 재다운로드·셀프 다운로드는 무료(멱등).
 */
export class DownloadUserMapUseCase {
  static async execute(mapId: string): Promise<{
    name: string; creatorName: string; firstDownload: boolean; charged: boolean; newBalance: number | null;
  }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError('맵을 다운로드하려면 로그인이 필요합니다.');
    }

    return UserMapRepository.download(mapId);
  }
}
