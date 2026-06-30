import { createClient } from '@/lib/supabase/server';
import { MapEntity } from '@/core/entities/Map';
import { MapRepository } from '@/infrastructure/supabase/mapRepository';
import { UserRepository } from '@/infrastructure/supabase/userRepository';
import { AuthenticationError, PermissionDeniedError, ValidationError } from '@/core/errors/AppError';

export class SaveMapUseCase {
  static async execute(mapData: Partial<MapEntity>): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError('맵을 저장하려면 로그인이 필요합니다.');
    }

    const role = await UserRepository.getUserRole(user.id);
    
    // 현재는 admin만 저장 가능하도록 제한 (추후 premium 등급도 에디터 권한 부여 가능)
    if (role !== 'admin') {
      throw new PermissionDeniedError('맵 저장 기능은 관리자(Admin) 전용입니다.');
    }

    if (!mapData.name || mapData.name.trim() === '') {
      throw new ValidationError('맵 이름은 필수입니다.');
    }
    
    // mapId가 없으면 UUID 생성 (클라이언트에서 생성해서 넘기는 것이 좋으나 방어 코드 추가)
    if (!mapData.id) {
      mapData.id = crypto.randomUUID();
    }

    // 기본값 세팅 및 MapEntity 캐스팅
    const fullMapData: MapEntity = {
      id: mapData.id,
      name: mapData.name,
      description: mapData.description || '',
      lengthType: mapData.lengthType || 'Middle',
      complexity: mapData.complexity || 'Medium',
      worldHeight: mapData.worldHeight || 2400,
      wallStyle: mapData.wallStyle || 'straight',
      bgImage: mapData.bgImage,
      themeWeights: mapData.themeWeights || {},
      layoutConfig: mapData.layoutConfig || {},
      items: mapData.items || []
    };

    await MapRepository.save(fullMapData);
  }
}
