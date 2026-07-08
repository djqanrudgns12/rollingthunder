import { createClient } from '@/lib/supabase/server';
import { UserMapEntity, USER_MAP_SLOT_LIMIT } from '@/core/entities/UserMap';
import { UserMapRepository } from '@/infrastructure/supabase/userMapRepository';
import { UserRepository } from '@/infrastructure/supabase/userRepository';
import { AuthenticationError, PermissionDeniedError, ValidationError } from '@/core/errors/AppError';
import { MapPresets, DEFAULT_THEME_WEIGHTS } from '@/engine/MapPresets';

/**
 * premium/admin 의 개인 커스텀 맵 저장 (user_maps 테이블).
 * 공식맵 저장(SaveMapUseCase → maps 테이블, admin 전용)과 분리된 경로다.
 * 슬롯 제한: premium 10개(admin 무제한) — DB 트리거가 최종 권위, 여기서는 친절한 사전 체크.
 */
export class SaveUserMapUseCase {
  static async execute(mapData: Partial<UserMapEntity>): Promise<{ mapId: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError('맵을 저장하려면 로그인이 필요합니다.');
    }

    const role = await UserRepository.getUserRole(user.id);
    if (role !== 'admin' && role !== 'premium') {
      throw new PermissionDeniedError('커스텀 맵 저장은 프리미엄 등급부터 가능합니다.');
    }

    if (!mapData.name || mapData.name.trim() === '') {
      throw new ValidationError('맵 이름은 필수입니다.');
    }

    // 기본맵 덮어쓰기 방어: 엔진 프리셋 id 는 user_maps 네임스페이스에 존재할 수 없다.
    if (mapData.id && MapPresets[mapData.id]) {
      throw new PermissionDeniedError('기본 맵은 수정할 수 없습니다. 사본으로 저장해 주세요.');
    }

    // 기존 맵 업데이트인지 확인 (id가 있어도 남의 맵/없는 맵이면 신규 저장으로 처리)
    let existingId: string | undefined;
    if (mapData.id) {
      const existing = await UserMapRepository.findById(mapData.id);
      if (existing && existing.ownerId === user.id) {
        existingId = existing.id;
      }
    }

    // 신규 저장 슬롯 사전 체크 (admin 무제한)
    if (!existingId && role !== 'admin') {
      const count = await UserMapRepository.countByOwner(user.id);
      if (count >= USER_MAP_SLOT_LIMIT) {
        throw new ValidationError(
          `맵 슬롯이 가득 찼습니다. (${count}/${USER_MAP_SLOT_LIMIT}) 기존 맵을 삭제한 후 저장해 주세요.`
        );
      }
    }

    const finalThemeWeights: Record<string, number> =
      mapData.themeWeights && Object.keys(mapData.themeWeights).length > 0
        ? mapData.themeWeights
        : { ...DEFAULT_THEME_WEIGHTS };

    const mapId = await UserMapRepository.save({
      id: existingId,
      ownerId: user.id,
      name: mapData.name.trim(),
      description: mapData.description || '',
      lengthType: mapData.lengthType || 'Middle',
      complexity: mapData.complexity || 'Medium',
      worldHeight: mapData.worldHeight || 2400,
      wallStyle: mapData.wallStyle || 'straight',
      bgImage: mapData.bgImage,
      themeWeights: finalThemeWeights,
      layoutConfig: mapData.layoutConfig || {},
      items: mapData.items || [],
      schemaVersion: 1,
    });

    return { mapId };
  }
}
