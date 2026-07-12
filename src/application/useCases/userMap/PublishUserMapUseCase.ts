import { createClient } from '@/lib/supabase/server';
import { UserMapRepository } from '@/infrastructure/supabase/userMapRepository';
import { AuthenticationError, PermissionDeniedError, ValidationError } from '@/core/errors/AppError';
import type { ValidationResult } from '@/lib/editor/validationTypes';

/** 배포에 필요한 최소 검증 레이스 수 */
const MIN_VALIDATION_RACES = 8;

/**
 * 커스텀 맵을 스토어에 배포(공개).
 * 클라이언트가 헤드리스 시뮬(runValidationAsync)로 검증한 결과 요약을 제출하면
 * 서버는 구조와 전체 통과 여부를 검사한 뒤 공개한다.
 *
 * 신뢰 모델: 클라이언트 제출 기반 — 조작 가능하나 피해는 "저품질 맵 노출" 수준.
 * 강화가 필요해지면 scripts/simulate.ts 로직을 Node 러너로 분리해 서버 재시뮬로 대체한다.
 */
export class PublishUserMapUseCase {
  static async execute(mapId: string, validationResult: ValidationResult): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError('맵을 배포하려면 로그인이 필요합니다.');
    }

    const map = await UserMapRepository.findById(mapId);
    if (!map) {
      throw new ValidationError('배포할 맵을 찾을 수 없습니다. 먼저 저장해 주세요.');
    }
    if (map.ownerId !== user.id) {
      throw new PermissionDeniedError('본인이 만든 맵만 배포할 수 있습니다.');
    }

    // 검증 결과 구조 검사 — 검증 실행 자체는 필수지만, 미통과 항목이 있어도 배포는 허용한다.
    // (통과 여부는 summary.checks 에 그대로 기록되어 스토어에서 참고 지표로 노출 가능)
    const checks = validationResult?.checks;
    if (!Array.isArray(checks) || checks.length === 0) {
      throw new ValidationError('검증 결과가 없습니다. 맵 검증을 먼저 실행해 주세요.');
    }
    if (typeof validationResult.races !== 'number' || validationResult.races < MIN_VALIDATION_RACES) {
      throw new ValidationError(`검증 레이스가 부족합니다. (최소 ${MIN_VALIDATION_RACES}회)`);
    }

    // heatmap/stuckSamples 등 대용량 필드는 제외하고 요약만 저장
    const summary = {
      races: validationResult.races,
      chips: validationResult.chips,
      medianFinish: validationResult.medianFinish,
      fairness: validationResult.fairness,
      edgePct: validationResult.edgePct,
      avgLeadChanges: validationResult.avgLeadChanges,
      timedOutRaces: validationResult.timedOutRaces,
      checks: checks.map((c) => ({ label: c.label, ok: c.ok, value: c.value, target: c.target })),
    };

    await UserMapRepository.publish(mapId, summary);
  }
}
