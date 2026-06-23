import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

export class MapBuilder {
  static createRect(world: RAPIER.World, x: number, y: number, w: number, h: number, type: 'wall', rotation: number = 0, restitution: number = 0.2, friction: number = 0.5) {
    // rotation(각도) 지원 추가. Rapier는 라디안 단위를 사용하므로 변환.
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y).setRotation(rotation * (Math.PI / 180));
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    
    // Rapier의 cuboid는 half-extents (폭/높이의 절반) 값을 인자로 받음
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2)
      .setRestitution(restitution)
      .setFriction(friction);

    world.createCollider(colliderDesc, rigidBody);
    const userData: UserData = { type, w, h };
    rigidBody.userData = userData;
    return rigidBody;
  }

  static createWalls(world: RAPIER.World, width: number, height: number, thickness: number = 100) {
    // 좌측 벽
    this.createRect(world, -thickness / 2, height / 2, thickness, height * 2, 'wall');
    // 우측 벽
    this.createRect(world, width + thickness / 2, height / 2, thickness, height * 2, 'wall');
    // 바닥 (현재는 칩들이 결승선(화면 아래)을 통과해야 하므로 바닥을 생성하지 않음)
  }

  static createPin(world: RAPIER.World, x: number, y: number, radius: number, isBumper = false, restitution?: number, friction?: number) {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    
    const defaultRestitution = isBumper ? 1.8 : 0.4;
    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setRestitution(restitution ?? defaultRestitution) // 범퍼는 맞으면 강하게 튕겨나감 (유저 커스텀 허용)
      .setFriction(friction ?? 0.1);

    world.createCollider(colliderDesc, rigidBody);
    const userData: UserData = { type: isBumper ? 'bumper' : 'pin', radius };
    rigidBody.userData = userData;
    return rigidBody;
  }

  static createKinematic(world: RAPIER.World, item: any) {
    // 동적(Kinematic) 장애물: 외부 힘에 밀리지 않고 프로그래밍된 속도(Speed)로만 움직입니다.
    const desc = RAPIER.RigidBodyDesc.kinematicVelocityBased()
      .setTranslation(item.x, item.y)
      .setRotation(item.rotation ? item.rotation * (Math.PI / 180) : 0);
    const body = world.createRigidBody(desc);
    
    if (item.type === 'windmill') {
      // 십자가 모양 렌더링을 위해 두 개의 직사각형 Collider 교차 연결
      const c1 = RAPIER.ColliderDesc.cuboid(50, 5).setRestitution(1.2);
      const c2 = RAPIER.ColliderDesc.cuboid(5, 50).setRestitution(1.2);
      world.createCollider(c1, body);
      world.createCollider(c2, body);
      body.setAngvel(item.speed || 3, true);
    }
    
    body.userData = { type: item.type, speed: item.speed, id: item.id } as UserData;
    return body;
  }

  static createSensor(world: RAPIER.World, item: any) {
    // 센서(Sensor): 충돌하지 않고 통과할 때 이벤트를 발생시킵니다 (포탈, 부스터, 중력장)
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(item.x, item.y);
    const body = world.createRigidBody(desc);
    let colliderDesc;
    
    if (item.type === 'portal') {
      colliderDesc = RAPIER.ColliderDesc.ball(20).setSensor(true);
    } else if (item.type === 'booster') {
      colliderDesc = RAPIER.ColliderDesc.cuboid(25, 25).setSensor(true);
    } else if (item.type === 'blackhole' || item.type === 'whitehole') {
      colliderDesc = RAPIER.ColliderDesc.ball(item.radius || 150).setSensor(true);
    }

    if (colliderDesc) {
      colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      world.createCollider(colliderDesc, body);
    }
    
    body.userData = {
      type: item.type,
      id: item.id,
      color: item.color,
      power: item.power,
      rotation: item.rotation,
      force: item.force,
      radius: item.radius
    } as UserData;
    return body;
  }

  static buildRandomMap(world: RAPIER.World, width: number, height: number, density: number) {
    // 그리드 시스템 기반으로 무작위 장애물 핀/범퍼 생성
    const cols = Math.floor(width / 50);
    const rows = Math.floor((height * 0.75) / 50);
    const startY = height * 0.15;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (Math.random() * 100 < density) {
          const offsetX = (row % 2 === 0) ? 0 : 25; // 육각형 지그재그 구조 패턴
          const x = 25 + col * 50 + offsetX;
          const y = startY + row * 50;
          
          if (x < width - 15) {
            const isBumper = Math.random() > 0.85; // 15% 확률로 바운싱 범퍼
            const radius = isBumper ? 10 : 6;
            this.createPin(world, x, y, radius, isBumper);
          }
        }
      }
    }
  }
}
