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
        // 질량 무한대 및 크기 증폭 (추가 질량 부여)
        // Rapier2D 규격에 맞춰 mass와 principal_angular_inertia 전달
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (targetBody as any).setAdditionalMassProps(100, 0, true);
        break;
      case 'booster':
        // 강한 하방 추진력
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (targetBody as any).applyImpulse({ x: 0, y: 300 }, true);
        break;
      // 추가 스킬들은 MapBuilder 및 추가 컴포넌트와 연계하여 구현
      default:
        break;
    }
  }
}
