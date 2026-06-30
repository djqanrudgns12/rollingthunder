'use server';

import { SaveMapUseCase } from '@/application/useCases/map/SaveMapUseCase';
import { MapEntity } from '@/core/entities/Map';
import { AppError } from '@/core/errors/AppError';

export async function saveMapAction(mapData: Partial<MapEntity>) {
  try {
    await SaveMapUseCase.execute(mapData);
    return { success: true, mapId: mapData.id };
  } catch (error: any) {
    if (error instanceof AppError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: '알 수 없는 오류가 발생했습니다.', code: 'UNKNOWN_ERROR' };
  }
}

export async function getMapsAction() {
  const { GetMapsUseCase } = await import('@/application/useCases/map/GetMapsUseCase');
  const maps = await GetMapsUseCase.execute();
  return maps;
}

export async function deployMapAction(mapId: string) {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { UserRepository } = await import('@/infrastructure/supabase/userRepository');
    const { MapRepository } = await import('@/infrastructure/supabase/mapRepository');
    const { PermissionDeniedError, AppError } = await import('@/core/errors/AppError');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    const role = await UserRepository.getUserRole(user.id);
    if (role !== 'admin') {
      throw new PermissionDeniedError('서버 배포 기능은 관리자 전용입니다.');
    }

    await MapRepository.setOfficial(mapId, true);
    return { success: true };
  } catch (error: any) {
    if (error.code) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: '알 수 없는 오류가 발생했습니다.', code: 'UNKNOWN_ERROR' };
  }
}
