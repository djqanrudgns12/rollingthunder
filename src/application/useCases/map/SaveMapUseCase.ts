import { createClient } from '@/lib/supabase/server';
import { MapEntity } from '@/core/entities/Map';
import { MapRepository } from '@/infrastructure/supabase/mapRepository';
import { UserRepository } from '@/infrastructure/supabase/userRepository';
import { AuthenticationError, PermissionDeniedError, ValidationError } from '@/core/errors/AppError';
import { MapPresets, DEFAULT_THEME_WEIGHTS } from '@/engine/MapPresets';

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

    // 기존 맵 정보 조회 (isOfficial 상태 유지를 위해)
    const existingMaps = await MapRepository.findAll();
    const existingMap = existingMaps.find(m => m.id === mapData.id);
    const presetMap = MapPresets[mapData.id as string];
    
    let isOfficial = false;
    let finalName = mapData.name;

    if (existingMap || presetMap) {
      // 기존에 DB에 공식맵이거나 원본 프리셋이면 유지
      isOfficial = existingMap?.isOfficial ?? presetMap?.isOfficial ?? (presetMap ? true : false);
      // 공식맵이 아닌 커스텀 맵인데 이름에 [커스텀]이 없으면 붙여줌
      if (!isOfficial && !finalName.startsWith('[커스텀]')) {
        finalName = `[커스텀] ${finalName}`;
      }
    } else {
      // 완전히 새 맵이면 무조건 커스텀 맵으로 강제
      isOfficial = false;
      if (!finalName.startsWith('[커스텀]')) {
        finalName = `[커스텀] ${finalName}`;
      }
    }

    // 빈 가중치 검사 후 기본값 주입
    const finalThemeWeights = (mapData.themeWeights && Object.keys(mapData.themeWeights).length > 0)
      ? mapData.themeWeights
      : DEFAULT_THEME_WEIGHTS;

    // 기본값 세팅 및 MapEntity 캐스팅
    const fullMapData: MapEntity = {
      id: mapData.id,
      name: finalName,
      description: mapData.description || '',
      isOfficial: isOfficial,
      lengthType: mapData.lengthType || 'Middle',
      complexity: mapData.complexity || 'Medium',
      worldHeight: mapData.worldHeight || 2400,
      wallStyle: mapData.wallStyle || 'straight',
      bgImage: mapData.bgImage,
      themeWeights: finalThemeWeights,
      layoutConfig: mapData.layoutConfig || {},
      items: mapData.items || []
    };

    await MapRepository.save(fullMapData);
  }
}
