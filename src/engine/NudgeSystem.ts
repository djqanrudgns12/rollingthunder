import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

export class NudgeSystem {
  static applyNudge(world: RAPIER.World, intensity: number = 80) {
    // 모든 동적 칩들에게 무작위 충격량(Impulse)을 가하여 고착 상태 탈출
    world.forEachRigidBody((body) => {
      const data = body.userData as UserData;
      if (data && data.type === 'chip') {
        const randomX = (Math.random() - 0.5) * intensity;
        const randomY = (Math.random() - 0.5) * intensity;
        body.applyImpulse({ x: randomX, y: randomY }, true);
      }
    });
  }
}
