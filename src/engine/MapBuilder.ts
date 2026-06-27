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
    const numSegments = Math.ceil((height * 2) / 100);
    for (let i = 0; i < numSegments; i++) {
      // Start from high above to far below to cover scroll
      const y = i * 100 - (height / 2);
      // Zig-zag effect: teeth protruding inward by 20
      const bump = (i % 2 === 0) ? 20 : 0;
      
      // left wall
      const leftId = `wall_l_${i}`;
      const leftBody = this.createRect(world, -thickness / 2 + bump, y, thickness, 100, 'wall');
      if(leftBody.userData) (leftBody.userData as UserData).id = leftId;
      
      // right wall
      const rightId = `wall_r_${i}`;
      const rightBody = this.createRect(world, width + thickness / 2 - bump, y, thickness, 100, 'wall');
      if(rightBody.userData) (rightBody.userData as UserData).id = rightId;
    }
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
    const id = `${isBumper ? 'bumper' : 'pin'}_${Math.floor(Math.random() * 1000000)}`;
    const userData: UserData = { type: isBumper ? 'bumper' : 'pin', radius, id };
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
    // 월드 높이(height)에 비례해 구간을 반복 생성한다. 출발선 y=50, 결승선 y>height+20.
    // 본문(obstacleStart ~ obstacleEnd)에 핀 그리드를 깔고, 일정 간격마다 램프/풍차/블랙홀을 섞는다.
    const obstacleStart = 200;
    const obstacleEnd = height - 250; // 마지막 깔때기 공간 확보
    let windmillId = 0;
    let blackholeId = 0;

    // --- 본문 핀 그리드 ---
    const cols = Math.floor(width / 50);
    for (let y = obstacleStart; y < obstacleEnd; y += 50) {
      const row = Math.round((y - obstacleStart) / 50);
      for (let col = 0; col < cols; col++) {
        if (Math.random() * 100 < (density * 0.8)) {
          const offsetX = (row % 2 === 0) ? 0 : 25; // 육각형 지그재그 패턴
          const x = 25 + col * 50 + offsetX;
          if (x > 50 && x < width - 50) {
            const isBumper = Math.random() > 0.85; // 15% 확률로 바운싱 범퍼
            const radius = isBumper ? 10 : 6;
            this.createPin(world, x, y, radius, isBumper);
          }
        }
      }
    }

    // --- 약 600px 간격마다 특수 구간 삽입(램프 / 풍차 / 블랙홀 순환) ---
    let zoneIndex = 0;
    for (let y = obstacleStart + 150; y < obstacleEnd - 150; y += 600) {
      const kind = zoneIndex % 3;
      if (kind === 0) {
        // 지그재그 램프
        this.createRect(world, width * 0.25, y, width * 0.4, 20, 'wall', 15);
        this.createRect(world, width * 0.75, y + 150, width * 0.4, 20, 'wall', -15);
      } else if (kind === 1) {
        // 풍차 한 쌍
        this.createKinematic(world, { type: 'windmill', x: width * 0.3, y, speed: 3 + Math.random() * 4, id: `rw${windmillId++}` });
        this.createKinematic(world, { type: 'windmill', x: width * 0.7, y: y + 120, speed: -(3 + Math.random() * 4), id: `rw${windmillId++}` });
      } else {
        // 블랙홀
        this.createSensor(world, { type: 'blackhole', x: width * 0.5, y, radius: 110, force: 3, id: `rbh${blackholeId++}` });
      }
      zoneIndex++;
    }

    // --- 최종 깔때기 (반드시 중앙에 틈을 남긴다) ---
    const f1 = height - 170;
    const f2 = height - 70;
    this.createRect(world, width * 0.2, f1, width * 0.4, 20, 'wall', 30);
    this.createRect(world, width * 0.8, f1, width * 0.4, 20, 'wall', -30);
    this.createRect(world, width * 0.225, f2, width * 0.45, 20, 'wall', 15);
    this.createRect(world, width * 0.775, f2, width * 0.45, 20, 'wall', -15);
  }
}
