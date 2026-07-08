'use server';

import { AppError } from '@/core/errors/AppError';
import { UserMapEntity, UserMapDownloadEntity } from '@/core/entities/UserMap';
import type { ValidationResult } from '@/lib/editor/validationTypes';

type ActionResult<T = {}> =
  | ({ success: true } & T)
  | { success: false; error: string; code: string };

function toFailure(error: any): { success: false; error: string; code: string } {
  if (error instanceof AppError) {
    return { success: false, error: error.message, code: error.code };
  }
  console.error('[userMapActions]', error);
  return { success: false, error: '알 수 없는 오류가 발생했습니다.', code: 'UNKNOWN_ERROR' };
}

export async function saveUserMapAction(
  mapData: Partial<UserMapEntity>
): Promise<ActionResult<{ mapId: string }>> {
  try {
    const { SaveUserMapUseCase } = await import('@/application/useCases/userMap/SaveUserMapUseCase');
    const { mapId } = await SaveUserMapUseCase.execute(mapData);
    return { success: true, mapId };
  } catch (error) {
    return toFailure(error);
  }
}

export async function publishUserMapAction(
  mapId: string,
  validationResult: ValidationResult
): Promise<ActionResult> {
  try {
    const { PublishUserMapUseCase } = await import('@/application/useCases/userMap/PublishUserMapUseCase');
    await PublishUserMapUseCase.execute(mapId, validationResult);
    return { success: true };
  } catch (error) {
    return toFailure(error);
  }
}

export async function getMyUserMapsAction(): Promise<ActionResult<{ maps: UserMapEntity[] }>> {
  try {
    const { GetMyUserMapsUseCase } = await import('@/application/useCases/userMap/GetMyUserMapsUseCase');
    const maps = await GetMyUserMapsUseCase.execute();
    return { success: true, maps };
  } catch (error) {
    return toFailure(error);
  }
}

export async function deleteUserMapAction(mapId: string): Promise<ActionResult> {
  try {
    const { DeleteUserMapUseCase } = await import('@/application/useCases/userMap/DeleteUserMapUseCase');
    await DeleteUserMapUseCase.execute(mapId);
    return { success: true };
  } catch (error) {
    return toFailure(error);
  }
}

export async function getStoreMapsAction(options?: {
  sort?: 'popular' | 'latest';
  limit?: number;
}): Promise<ActionResult<{ maps: UserMapEntity[] }>> {
  try {
    const { GetStoreMapsUseCase } = await import('@/application/useCases/userMap/GetStoreMapsUseCase');
    const maps = await GetStoreMapsUseCase.execute(options);
    return { success: true, maps };
  } catch (error) {
    return toFailure(error);
  }
}

export async function downloadUserMapAction(mapId: string): Promise<
  ActionResult<{
    name: string;
    creatorName: string;
    firstDownload: boolean;
    charged: boolean;
    newBalance: number | null;
  }>
> {
  try {
    const { DownloadUserMapUseCase } = await import('@/application/useCases/userMap/DownloadUserMapUseCase');
    const result = await DownloadUserMapUseCase.execute(mapId);
    return { success: true, ...result };
  } catch (error) {
    return toFailure(error);
  }
}

export async function getMyDownloadsAction(): Promise<
  ActionResult<{ downloads: UserMapDownloadEntity[] }>
> {
  try {
    const { GetMyDownloadsUseCase } = await import('@/application/useCases/userMap/GetMyDownloadsUseCase');
    const downloads = await GetMyDownloadsUseCase.execute();
    return { success: true, downloads };
  } catch (error) {
    return toFailure(error);
  }
}

export async function toggleMapLikeAction(
  mapId: string
): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { AuthenticationError } = await import('@/core/errors/AppError');
    const { UserMapRepository } = await import('@/infrastructure/supabase/userMapRepository');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new AuthenticationError('좋아요는 로그인 후 이용할 수 있습니다.');
    }

    const result = await UserMapRepository.toggleLike(mapId);
    return { success: true, ...result };
  } catch (error) {
    return toFailure(error);
  }
}

export async function getLikedMapIdsAction(): Promise<ActionResult<{ mapIds: string[] }>> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { UserMapRepository } = await import('@/infrastructure/supabase/userMapRepository');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: true, mapIds: [] };
    }

    const mapIds = await UserMapRepository.findLikedMapIds(user.id);
    return { success: true, mapIds };
  } catch (error) {
    return toFailure(error);
  }
}
