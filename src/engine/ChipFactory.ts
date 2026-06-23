import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

export class ChipFactory {
  static createChip(world: RAPIER.World, x: number, y: number, radius: number, id: string): RAPIER.RigidBody {
    // 동적 강체 설정 - CCD 활성화로 터널링(오브젝트 관통) 버그 원천 차단
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y)
      .setCcdEnabled(true)
      .setLinearDamping(0.3); // 공기 저항 (마찰)

    const rigidBody = world.createRigidBody(rigidBodyDesc);

    // 탄성, 마찰력, 질량 밀도 최적화
    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setRestitution(0.6)  // 탄성
      .setFriction(0.2)     // 마찰력
      .setDensity(1.2)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    const collider = world.createCollider(colliderDesc, rigidBody);
    
    // 렌더링 시 사용할 메타데이터 주입
    const userData: UserData = { type: 'chip', id, radius };
    rigidBody.userData = userData;
    
    return rigidBody;
  }
}
