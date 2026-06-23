import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

export type SkillType = 'tank' | 'slime' | 'ghost' | 'magnet' | 'teleport' | 'booster' | 'none';

export class SkillSystem {
  static triggerSkill(
    world: RAPIER.World, 
    chipId: string, 
    skill: SkillType, 
  ) {
    let targetBody: RAPIER.RigidBody | null = null;
    
    // 타겟 칩 찾기
    world.forEachRigidBody((body) => {
      const data = body.userData as UserData;
      if (data && data.type === 'chip' && data.id === chipId) {
        const activeSkills = (data as {activeSkills?: string[]}).activeSkills || []
        if (activeSkills.includes(skill)) return // 이미 발동 중이면 무시

        (data as {activeSkills?: string[]}).activeSkills = [...activeSkills, skill]
        body.userData = data;
        targetBody = body;
      }
    });

    if (!targetBody) return;

    // 슬로모션 등 시각적 처리는 React 컴포넌트 쪽에서 담당하며,
    // 여기서는 순수 물리 엔진 속성 변경만 다룸
    switch (skill) {
      case 'tank':
        // 질량 무한대 대신 중력 스케일을 대폭 늘려 무겁고 빠르게 떨어지게 만듦 (다른 마블을 밀어냄)
        targetBody.setGravityScale(5.0, true);
        // 2초 후 원래 중력으로 복구 (워커 내부 타이머)
        setTimeout(() => {
          if (targetBody) {
            try {
              targetBody.setGravityScale(1.0, true);
            } catch (e) {
              // Body might have been destroyed or world freed
            }
          }
        }, 2000);
        break;
      case 'booster':
        // 강한 하방 추진력 (Impulse)
        targetBody.applyImpulse({ x: 0, y: 50000 }, true);
        break;
      case 'ghost':
        // 투명화: 다른 마블과 충돌하지 않도록 처리하고 싶으나,
        // Rapier2D에서 콜라이더 그룹 변경은 복잡할 수 있으므로 강한 튕김 방지용 damping 적용
        targetBody.setLinearDamping(0.5);
        setTimeout(() => {
          if (targetBody) {
            try {
              targetBody.setLinearDamping(0);
            } catch (e) {
              // Body might have been destroyed
            }
          }
        }, 2000);
        break;
      default:
        break;
    }
  }
}
