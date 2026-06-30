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
