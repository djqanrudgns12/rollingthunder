import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

// ── 물리 밸런스 상수 (PRD-nudge 고도화 기반) ──
// MAX_IMPULSE: 축당 임펄스 절대 상한. MAX_CHIP_SPEED(2000) × 300% = 6000.
// 극대화된 흔들림을 위해 상한을 대폭 높입니다.
const MAX_IMPULSE = 6000;
// Y_BIAS: 음수 = Rapier 좌표계에서 상향(-Y). 칩을 강하게 위로 띄워 사방팔방으로 흩어지게 합니다.
// -0.8 → 거의 모든 칩이 위로 솟구침.
const Y_BIAS = -0.8;

export class NudgeSystem {
  /**
   * 활성 칩 배열에 넛지 임펄스를 적용합니다.
   *
   * @param activeChips - 시뮬레이션 코어의 활성 칩 강체 배열
   * @param intensity - 목표 속도 변화량(px/s). 질량 정규화로 일정 체감 보장.
   *                    PhysicsCanvas에서 4000으로 호출 (사방팔방으로 튀도록 극대화).
   */
  static applyNudgeToChips(activeChips: RAPIER.RigidBody[], intensity: number = 4000): void {
    for (const body of activeChips) {
      const data = body.userData as UserData;
      if (data?.type === 'chip') {
        const m = body.mass() || 1;
        // X축: 좌우로 강하게 (-1 ~ 1) * intensity
        const dvx = (Math.random() - 0.5) * 2 * intensity;
        // Y축: 위로 솟구치도록 강하게 (-1.3 ~ -0.3) * intensity
        const dvy = (Math.random() - 0.5 + Y_BIAS) * 1.5 * intensity;

        // 축별 임펄스 = Δv × mass, 상한 클램프
        const capM = MAX_IMPULSE * m;
        const ix = Math.max(-capM, Math.min(capM, dvx * m));
        const iy = Math.max(-capM, Math.min(capM, dvy * m));

        body.applyImpulse({ x: ix, y: iy }, true);
        
        // 추가 고도화: 회전력(Torque) 부여로 칩들이 빙글빙글 돌며 더 역동적으로 흩어짐
        const torque = (Math.random() - 0.5) * intensity * 150 * m;
        body.applyTorqueImpulse(torque, true);
      }
    }
  }

  // 하위 호환: world를 직접 받는 레거시 메서드 (워커에서 미사용, 외부 참조 대비)
  static applyNudge(world: RAPIER.World, intensity: number = 150): void {
    world.forEachRigidBody((body) => {
      const data = body.userData as UserData;
      if (data?.type === 'chip') {
        const m = body.mass() || 1;
        const dvx = (Math.random() - 0.5) * intensity;
        const dvy = (Math.random() - 0.5 + Y_BIAS) * intensity;

        const capM = MAX_IMPULSE * m;
        const ix = Math.max(-capM, Math.min(capM, dvx * m));
        const iy = Math.max(-capM, Math.min(capM, dvy * m));

        body.applyImpulse({ x: ix, y: iy }, true);
      }
    });
  }
}
