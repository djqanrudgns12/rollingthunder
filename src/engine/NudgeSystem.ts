import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

export class NudgeSystem {
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
