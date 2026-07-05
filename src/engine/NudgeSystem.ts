import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

export class NudgeSystem {
  // [성능 최적화] activeChips 배열을 직접 받아 넛지 적용 — forEachRigidBody 제거.
  // 왜: world.forEachRigidBody는 모든 강체(벽, 기물 포함)를 순회하므로 낭비.
  static applyNudgeToChips(activeChips: RAPIER.RigidBody[], intensity: number = 150) {
    for (const body of activeChips) {
      const data = body.userData as UserData;
      if (data && data.type === 'chip') {
        const m = body.mass() || 1;
        const dvx = (Math.random() - 0.5) * intensity;
        const dvy = (Math.random() - 0.5) * intensity;
        body.applyImpulse({ x: dvx * m, y: dvy * m }, true);
      }
    }
  }

  // 하위 호환: world를 직접 받는 기존 메서드 유지
  // intensity 는 "목표 속도 변화량(px/s)" 단위. 질량으로 정규화하여 칩 질량이 바뀌어도
  // 일정한 체감 흔들림을 보장한다(impulse = Δv × mass).
  static applyNudge(world: RAPIER.World, intensity: number = 150) {
    world.forEachRigidBody((body) => {
      const data = body.userData as UserData;
      if (data && data.type === 'chip') {
        const m = body.mass() || 1;
        const dvx = (Math.random() - 0.5) * intensity;
        const dvy = (Math.random() - 0.5) * intensity;
        body.applyImpulse({ x: dvx * m, y: dvy * m }, true);
      }
    });
  }
}
