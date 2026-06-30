import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

// 외벽 스타일: 맵마다 다른 외벽 형태를 지정하여 시각적·물리적 다양성 확보
export type WallStyle = 'straight' | 'zigzag' | 'narrow' | 'wide' | 'funnel' | 'hourglass' | 'diamond' | 'wave' | 'sawtooth' | 'asymmetric';

function getWallTransform(y: number, height: number, style: WallStyle) {
  let leftOffset = 0, rightOffset = 0, leftAngle = 0, rightAngle = 0;
  const progress = Math.max(0, Math.min(1, y / height));

  switch (style) {
    case 'narrow':
      leftOffset = 100; rightOffset = 100;
      break;
    case 'wide':
      leftOffset = -50; rightOffset = -50;
      break;
    case 'zigzag': {
      const isBump = Math.round(y / 100) % 2 === 0;
      leftOffset = isBump ? 20 : 0; rightOffset = isBump ? 20 : 0;
      break;
    }
    case 'funnel': {
      leftOffset = progress * 200; rightOffset = progress * 200;
      const dx = 200 / height;
      const angle = Math.atan(dx) * (180 / Math.PI);
      leftAngle = angle; rightAngle = -angle; 
      break;
    }
    case 'hourglass': {
      const dist = Math.abs(progress - 0.5);
      leftOffset = 150 - dist * 300; rightOffset = 150 - dist * 300;
      const dx = progress < 0.5 ? (300 / height) : (-300 / height);
      const angle = Math.atan(dx) * (180 / Math.PI);
      leftAngle = angle; rightAngle = -angle;
      break;
    }
    case 'diamond': {
      const dist = Math.abs(progress - 0.5);
      leftOffset = dist * 300 - 50; rightOffset = dist * 300 - 50;
      const dx = progress < 0.5 ? (-300 / height) : (300 / height);
      const angle = Math.atan(dx) * (180 / Math.PI);
      leftAngle = angle; rightAngle = -angle;
      break;
    }
    case 'wave': {
      const freq = (2 * Math.PI) / 800;
      leftOffset = Math.sin(y * freq) * 60 + 20;
      rightOffset = Math.sin(y * freq) * 60 + 20;
      const dx = Math.cos(y * freq) * 60 * freq;
      const angle = Math.atan(dx) * (180 / Math.PI);
      leftAngle = angle; rightAngle = -angle;
      break;
    }
    case 'sawtooth': {
      const localY = ((y % 400) + 400) % 400;
      if (localY < 300) {
        leftOffset = (localY / 300) * 120; rightOffset = (localY / 300) * 120;
        const angle = Math.atan(120 / 300) * (180 / Math.PI);
        leftAngle = angle; rightAngle = -angle;
      } else {
        leftOffset = 120 - ((localY - 300) / 100) * 120; rightOffset = 120 - ((localY - 300) / 100) * 120;
        const angle = Math.atan(-120 / 100) * (180 / Math.PI);
        leftAngle = angle; rightAngle = -angle;
      }
      break;
    }
    case 'asymmetric': {
      const freq = (2 * Math.PI) / 1000;
      const shift = Math.sin(y * freq) * 150;
      leftOffset = shift; rightOffset = -shift;
      const dx = Math.cos(y * freq) * 150 * freq;
      const angle = Math.atan(dx) * (180 / Math.PI);
      leftAngle = angle; rightAngle = angle; 
      break;
    }
  }
  return { leftOffset, rightOffset, leftAngle, rightAngle };
}

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

  static createWalls(world: RAPIER.World, width: number, height: number, thickness: number = 100, style: WallStyle = 'zigzag') {
    const numSegments = Math.ceil((height * 2) / 100) + 10; // Extra padding
    for (let i = -5; i < numSegments; i++) {
      const y = i * 100 - (height / 2);
      
      const { leftOffset, rightOffset, leftAngle, rightAngle } = getWallTransform(y, height, style);
      
      const leftId = `wall_l_${i}`;
      const leftBody = this.createRect(world, -thickness / 2 + leftOffset, y, thickness, 100, 'wall', leftAngle, 0.2, 0.05);
      if(leftBody.userData) (leftBody.userData as UserData).id = leftId;

      const rightId = `wall_r_${i}`;
      const rightBody = this.createRect(world, width + thickness / 2 - rightOffset, y, thickness, 100, 'wall', rightAngle, 0.2, 0.05);
      if(rightBody.userData) (rightBody.userData as UserData).id = rightId;
    }
  }

  static createPolygon(world: RAPIER.World, item: any) {
    if (!item.vertices || item.vertices.length < 3) return null;
    
    // Create a polyline collider. Vertices must be a Float32Array of [x0, y0, x1, y1, ...]
    // Polyline needs an extra vertex at the end to close the loop
    const vertices = new Float32Array((item.vertices.length + 1) * 2);
    for (let i = 0; i < item.vertices.length; i++) {
      vertices[i * 2] = item.vertices[i].x;
      vertices[i * 2 + 1] = item.vertices[i].y;
    }
    // Close the loop
    vertices[item.vertices.length * 2] = item.vertices[0].x;
    vertices[item.vertices.length * 2 + 1] = item.vertices[0].y;

    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(item.x, item.y);
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    // Use polyline to support concave shapes easily
    const colliderDesc = RAPIER.ColliderDesc.polyline(vertices)
      .setRestitution(item.restitution ?? 0.4)
      .setFriction(item.friction ?? 0.1);

    world.createCollider(colliderDesc, rigidBody);
    
    const userData: any = { type: 'polygon', id: item.id, vertices: item.vertices };
    rigidBody.userData = userData;
    return rigidBody;
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
    // 피스톤은 setNextKinematicTranslation으로 강제 좌표 이동을 하므로 위치 기반(PositionBased)을 사용해야 물리 엔진이 이동 속도를 역산하여 터널링을 방지합니다.
    const desc = item.type === 'piston' 
      ? RAPIER.RigidBodyDesc.kinematicPositionBased()
      : RAPIER.RigidBodyDesc.kinematicVelocityBased();
      
    desc.setTranslation(item.x, item.y)
      .setRotation(item.rotation ? item.rotation * (Math.PI / 180) : 0);
      
    // 피스톤(얇은 강체) 터널링 방지를 위해 CCD 활성화
    if (item.type === 'piston') {
      desc.setCcdEnabled(true);
    }
    
    const body = world.createRigidBody(desc);
    
    if (item.type === 'windmill') {
      // 십자가 모양 렌더링을 위해 두 개의 직사각형 Collider 교차 연결
      // 끼임 방지를 위해 탄성(restitution)을 높임 (1.2 -> 1.5)
      const w = item.w || 100;
      const h = item.h || 10;
      const c1 = RAPIER.ColliderDesc.cuboid(w / 2, h / 2).setRestitution(1.5);
      const c2 = RAPIER.ColliderDesc.cuboid(h / 2, w / 2).setRestitution(1.5);
      world.createCollider(c1, body);
      world.createCollider(c2, body);
      body.setAngvel(item.speed || 3, true);
    } else if (item.type === 'spinner') {
      // 룰렛 스피너: 일자바 형태의 동적 장애물
      const w = item.w || 200;
      const h = item.h || 20;
      const c = RAPIER.ColliderDesc.cuboid(w / 2, h / 2).setRestitution(1.4).setFriction(0.2);
      world.createCollider(c, body);
      body.setAngvel(item.speed || 5, true);
    } else if (item.type === 'piston') {
      // 피스톤: 직사각형 이동 플랫폼 (A↔B 왕복)
      const w = item.w || 100;
      const h = item.h || 20;
      // 물리적 두께(Collider)를 렌더링 두께보다 약간 키워 초고속 칩 관통 방지 마진 확보
      const physicsH = h + 8;
      const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, physicsH / 2)
        .setRestitution(0.3)
        .setFriction(0.8);
      world.createCollider(colliderDesc, body);
    }
    
    // piston은 원점(A지점)과 도착점(B지점), 크기 정보를 추가로 저장
    const userData: any = { type: item.type, speed: item.speed, id: item.id };
    if (item.type === 'piston') {
      userData.originX = item.x;
      userData.originY = item.y;
      userData.waypointB = item.waypointB;
      userData.w = item.w || 100;
      userData.h = item.h || 20;
    } else if (item.type === 'spinner') {
      userData.w = item.w || 200;
      userData.h = item.h || 20;
    }
    body.userData = userData as UserData;
    return body;
  }

  static createSensor(world: RAPIER.World, item: any) {
    // 센서(Sensor): 충돌하지 않고 통과할 때 이벤트를 발생시킵니다 (포탈, 부스터, 중력장)
    const desc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(item.x, item.y)
      .setRotation((item.rotation || 0) * (Math.PI / 180));
    const body = world.createRigidBody(desc);
    let colliderDesc;
    
    if (item.type === 'portal') {
      // 반경 확대(20→38): "확률 지름길"이 의미 있게 작동하도록(칩 일부가 실제로 워프)
      colliderDesc = RAPIER.ColliderDesc.ball(38).setSensor(true);
    } else if (item.type === 'booster') {
      // 넓은 가속 패드(50×50→90×44): 레인을 가로질러 안정적으로 트리거되도록 확대
      colliderDesc = RAPIER.ColliderDesc.cuboid(45, 22).setSensor(true);
    } else if (item.type === 'blackhole' || item.type === 'whitehole') {
      colliderDesc = RAPIER.ColliderDesc.ball(item.radius || 150).setSensor(true);
    } else if (item.type === 'hole') {
      // 함정 구멍: 칩이 진입하면 패널티 리스폰(물리 충돌 없이 이벤트만 발생)
      colliderDesc = RAPIER.ColliderDesc.ball(item.radius || 30).setSensor(true);
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

  static createBreakableBlock(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(item.x, item.y);
    const body = world.createRigidBody(desc);
    
    const w = item.w || 60;
    const h = item.h || 25;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2)
      .setRestitution(0.1)
      .setFriction(0.05)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    
    world.createCollider(colliderDesc, body);
    body.userData = {
      type: 'iceblock',
      id: item.id,
      w, h,
      hp: item.hp || 3,
      maxHp: item.hp || 3,
    } as UserData;
    return body;
  }

  static createWindCannon(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(item.x, item.y);
    const body = world.createRigidBody(desc);
    
    const w = item.w || 120;
    const h = item.h || 120;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      
    world.createCollider(colliderDesc, body);
    body.userData = {
      type: 'windcannon',
      id: item.id,
      w, h,
      windAngle: item.windAngle || 90,
      windForce: item.force || 300,
      onFrames: item.onFrames || 180,
      offFrames: item.offFrames || 120,
    } as UserData;
    return body;
  }

  static createLuckyGate(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(item.x, item.y);
    const body = world.createRigidBody(desc);
    
    const w = item.w || 140;
    const h = 15;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    
    world.createCollider(colliderDesc, body);
    body.userData = {
      type: 'luckygate',
      id: item.id,
      w, h,
    } as UserData;
    return body;
  }

  static createFlipper(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.kinematicVelocityBased()
      .setTranslation(item.x, item.y)
      .setRotation((item.restAngle || 20) * (Math.PI / 180))
      .setCcdEnabled(true);
    
    const body = world.createRigidBody(desc);
    
    const length = item.length || 90;
    const thickness = item.h || 12;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(length / 2, thickness / 2)
      .setTranslation(length / 2, 0)
      .setRestitution(1.6)
      .setFriction(0.3);
    
    world.createCollider(colliderDesc, body);
    
    const sensorDesc = RAPIER.ColliderDesc.cuboid(length / 2 + 10, 30)
      .setTranslation(length / 2, 25)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    world.createCollider(sensorDesc, body);
    
    body.userData = {
      type: 'flipper',
      id: item.id,
      length,
      restAngle: item.restAngle || 20,
      swingAngle: item.swingAngle || -40,
      state: 'idle',
      stateFrame: 0,
      swingSpeed: item.swingSpeed || 30,
      returnSpeed: item.returnSpeed || 8,
      side: item.side || 'left',
    } as UserData;
    return body;
  }

  static createPolygon(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(item.x, item.y)
      .setRotation((item.angle || item.rotation || 0) * (Math.PI / 180));
    const body = world.createRigidBody(desc);
    
    // Ensure we have vertices
    const vertices = item.vertices || [
      { x: -50, y: -50 },
      { x: 50, y: -50 },
      { x: 50, y: 50 },
      { x: -50, y: 50 }
    ];

    // RAPIER requires a flat Float32Array for polyline or convex decomposition
    // Convert array of {x, y} to flat array [x1, y1, x2, y2, ...]
    const flatVertices = new Float32Array(vertices.length * 2);
    for (let i = 0; i < vertices.length; i++) {
      flatVertices[i * 2] = vertices[i].x;
      flatVertices[i * 2 + 1] = vertices[i].y;
    }

    // For a simple wavy wall or hollow boundary, polyline is good.
    // However, if the polygon is supposed to be a solid block, we need convexDecomposition.
    // If we use convexDecomposition, we need the indices as well, which is more complex.
    // Let's use polyline for general curvy walls. If it's closed, append the first vertex to the end.
    
    // For now, let's create a polyline collider. It has no volume but stops objects.
    const colliderDesc = RAPIER.ColliderDesc.polyline(flatVertices)
      .setRestitution(item.restitution || 0.5)
      .setFriction(item.friction || 0.1);
      
    world.createCollider(colliderDesc, body);
    
    body.userData = {
      type: 'polygon',
      id: item.id,
      vertices: vertices,
    } as UserData;
    return body;
  }

  static buildRandomMap(world: RAPIER.World, width: number, height: number, density: number) {
    // 스마트 분산 배치:
    //  1) 구조물(램프/풍차/블랙홀/범퍼 클러스터)을 ~560px 구간마다 "골격"으로 먼저 배치하고
    //     각 구조물 주변에 keep-out 버퍼를 등록한다.
    //  2) 나머지 공간을 "지터드 헥사 그리드"(블루노이즈 근사) 핀 필드로 균일하게 채운다.
    //     밀도(density)는 '확률'이 아니라 '간격(spacing)'을 조절하므로 고밀도에서도 뭉치지 않고
    //     고르게 촘촘해진다. keep-out과 겹치는 핀은 건너뛰어 콜라이더 겹침(물리 오류)을 방지한다.
    const d = Math.max(0, Math.min(100, density)) / 100; // 0..1
    const obstacleStart = 200;
    const obstacleEnd = height - 280; // 마지막 깔때기 공간 확보
    const playLeft = 70;
    const playRight = width - 70;

    // ---- keep-out 레지스트리 (구조물 영역) ----
    const keepOut: { x: number; y: number; r: number }[] = [];
    const isClear = (x: number, y: number, r: number) => {
      for (const k of keepOut) {
        const dx = x - k.x, dy = y - k.y;
        const rr = k.r + r;
        if (dx * dx + dy * dy < rr * rr) return false;
      }
      return true;
    };
    const register = (x: number, y: number, r: number) => keepOut.push({ x, y, r });
    const registerWall = (cx: number, cy: number, w: number, deg: number) => {
      const rad = deg * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      for (let t = -w / 2; t <= w / 2; t += 36) register(cx + cos * t, cy + sin * t, 30);
    };

    let windmillId = 0, blackholeId = 0;

    // ---- 1) 구조물 골격: ~560px 구간마다 테마 1종 ----
    const zoneH = 560;
    let zi = 0;
    for (let zy = obstacleStart + 120; zy < obstacleEnd - 120; zy += zoneH) {
      const theme = zi % 4;
      if (theme === 0) {
        // 지그재그 램프
        const w = width * 0.42;
        this.createRect(world, width * 0.27, zy, w, 20, 'wall', 16);
        registerWall(width * 0.27, zy, w, 16);
        this.createRect(world, width * 0.73, zy + 170, w, 20, 'wall', -16);
        registerWall(width * 0.73, zy + 170, w, -16);
      } else if (theme === 1) {
        // 풍차 한 쌍 (회전 로터 반경 ~50 → keep-out 70)
        const ax = width * (0.30 + Math.random() * 0.06);
        const bx = width * (0.64 + Math.random() * 0.06);
        this.createKinematic(world, { type: 'windmill', x: ax, y: zy + 40, speed: 3 + Math.random() * 4, id: `rw${windmillId++}` });
        register(ax, zy + 40, 70);
        this.createKinematic(world, { type: 'windmill', x: bx, y: zy + 200, speed: -(3 + Math.random() * 4), id: `rw${windmillId++}` });
        register(bx, zy + 200, 70);
      } else if (theme === 2) {
        // 중앙 블랙홀
        const bx = width * 0.5, by = zy + 120;
        this.createSensor(world, { type: 'blackhole', x: bx, y: by, radius: 100, force: 3, id: `rbh${blackholeId++}` });
        register(bx, by, 120);
      } else {
        // 범퍼 클러스터 (아치)
        const cy = zy + 120, n = 5;
        for (let i = 0; i < n; i++) {
          const t = (i / (n - 1)) - 0.5; // -0.5..0.5
          const bx = width * 0.5 + t * width * 0.5;
          const by = cy + Math.cos(t * Math.PI) * 55;
          this.createPin(world, bx, by, 12, true);
          register(bx, by, 34);
        }
      }
      zi++;
    }

    // ---- 2) 지터드 헥사 그리드 핀 필드 (균일 분산, 간격=밀도) ----
    const spacing = 115 - d * 62;        // 희박(약 109px) → 조밀(약 53px)
    const jitter = spacing * 0.30;       // 격자 클러핑 방지용 미세 흔들림
    const bumperChance = 0.06 + d * 0.10;
    let rowIdx = 0;
    for (let y = obstacleStart; y < obstacleEnd; y += spacing) {
      const rowOffset = (rowIdx % 2) * (spacing / 2); // 헥사 스태거
      for (let x = playLeft + rowOffset; x <= playRight; x += spacing) {
        const px = x + (Math.random() * 2 - 1) * jitter;
        const py = y + (Math.random() * 2 - 1) * jitter;
        if (px < playLeft || px > playRight) continue;
        if (!isClear(px, py, 14)) continue; // 구조물과 겹치면 건너뜀
        const isBumper = Math.random() < bumperChance;
        this.createPin(world, px, py, isBumper ? 10 : 6, isBumper);
      }
      rowIdx++;
    }

    // ---- 최종 깔때기 (반드시 중앙에 틈을 남긴다) ----
    const f1 = height - 170;
    const f2 = height - 70;
    this.createRect(world, width * 0.2, f1, width * 0.4, 20, 'wall', 30);
    this.createRect(world, width * 0.8, f1, width * 0.4, 20, 'wall', -30);
    this.createRect(world, width * 0.225, f2, width * 0.45, 20, 'wall', 15);
    this.createRect(world, width * 0.775, f2, width * 0.45, 20, 'wall', -15);
  }
}
