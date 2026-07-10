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

    // 공식맵(maps 테이블) 저장은 admin 전용.
    // premium 의 커스텀 맵 저장은 별도 경로(SaveUserMapUseCase → user_maps)를 사용한다.
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
    // 불변식: 엔진 기본 프리셋 id 는 항상 공식(기본) 맵이다. 커스텀 맵은 UUID id 라 프리셋에 없다.
    const isPreset = !!MapPresets[mapData.id as string];

    // 공식맵 판별: 기본 프리셋 id 는 무조건 공식. 그 외는 DB 의 기존 상태를 따른다.
    const isOfficial = isPreset ? true : (existingMap?.isOfficial ?? false);

    // 이름 정규화:
    //  - 기본 프리셋: [커스텀] 말머리 금지 (과거에 잘못 붙었어도 자동 제거 → 자가 치유)
    //  - 커스텀 맵: [커스텀] 말머리 강제 (배포되어 공식이 되어도 이름은 유지)
    let finalName = mapData.name.trim();
    if (isPreset) {
      finalName = finalName.replace(/^\[커스텀\]\s*/, '');
    } else if (!finalName.startsWith('[커스텀]')) {
      finalName = `[커스텀] ${finalName}`;
    }

    // 빈 가중치 검사 후 기본값 주입
    const finalThemeWeights: Record<string, number> = (mapData.themeWeights && Object.keys(mapData.themeWeights).length > 0)
      ? mapData.themeWeights
      : { ...DEFAULT_THEME_WEIGHTS } as Record<string, number>;

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
