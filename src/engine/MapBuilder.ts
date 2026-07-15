import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';
import { computeWallSegments } from './wallGeometry';
import type { WallStyle } from './wallGeometry';

// 외벽 스타일은 단일 소스(wallGeometry)에서 정의하고 재노출한다.
export type { WallStyle };

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
    // 외벽 좌표/기울기는 단일 소스(computeWallSegments)에서 계산 — 에디터·미니맵과 완전 동일.
    const segments = computeWallSegments(width, height, thickness, style);
    for (const seg of segments) {
      const body = this.createRect(world, seg.x, seg.y, seg.w, seg.h, 'wall', seg.rotation, seg.restitution, seg.friction);
      if (body.userData) (body.userData as UserData).id = seg.id;
    }
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
    // 피스톤은 터널링 방지를 위해 속도 기반(VelocityBased)으로 설정하고 매 프레임 정확한 선속도를 계산하여 이동시킵니다.
    const desc = RAPIER.RigidBodyDesc.kinematicVelocityBased();
      
    desc.setTranslation(item.x, item.y)
      .setRotation((item.angle ?? item.rotation ?? 0) * (Math.PI / 180));
      
    // 얇은/빠른 강체의 칩 관통(터널링) 방지를 위해 CCD 활성화 (피스톤 이동 + 스피너/풍차 회전바)
    if (item.type === 'piston' || item.type === 'spinner' || item.type === 'windmill') {
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
      // 콜라이더 두께를 렌더 두께와 거의 일치시킴(과대 마진 제거) — 보이는 판 밖에서 튕기는 문제 해소.
      // 시각=콜라이더 동기화(OBSTACLE_FRAME) + 칩 CCD 로 관통은 별도 방지된다.
      const physicsH = h + 4;
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
      .setRotation((item.angle ?? item.rotation ?? 0) * (Math.PI / 180));
    const body = world.createRigidBody(desc);
    let colliderDesc;
    
    if (item.type === 'portal') {
      // 반경 확대(20→38): "확률 지름길"이 의미 있게 작동하도록(칩 일부가 실제로 워프)
      // 에디터에서 명시적으로 radius 를 지정한 포탈은 그 값을 존중(시각-물리 일치)
      colliderDesc = RAPIER.ColliderDesc.ball(item.radius || 38).setSensor(true);
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
      // 회전 소스 통일: 바디 회전/화살표 렌더(itemRotationRad)와 동일하게 angle 우선.
      // (기존엔 item.rotation 만 저장해 에디터에서 각도(angle)로 조준한 부스터의 힘이 무시됐다.)
      rotation: item.angle ?? item.rotation ?? 0,
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
    // 강한 아케이드 반발: 공이 얹혀 멈추지 않고 확실히 튕겨나가도록 restitution 상향.
    // (낮은 반발이면 수평 블록 위에 공이 정지 → 재타격이 없어 균열이 진행되지 않았다.)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2)
      .setRestitution(0.55)
      .setFriction(0.15)
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
    // 세기 소스 통일: 에디터/인스펙터는 windForce(레벨 단위, 기본 15)에 저장하고
    // 구버전 데이터는 force(px/s² 원시값)를 쓴다. 기존엔 force만 읽어 사용자 설정이 무시됐다.
    // 레벨 값(≤50)은 px/s² 가속으로 환산(×20: 레벨 15 ≈ 300px/s² ≈ 중력의 2배 측면 가속).
    const rawWind = item.windForce ?? item.force ?? 300;
    const windForce = rawWind <= 50 ? rawWind * 20 : rawWind;
    body.userData = {
      type: 'windcannon',
      id: item.id,
      w, h,
      windAngle: item.windAngle || 90,
      windForce,
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

  static createSpeedGate(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(item.x, item.y);
    const body = world.createRigidBody(desc);
    
    const w = item.w || 140;
    const h = 15;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    
    world.createCollider(colliderDesc, body);
    body.userData = {
      type: 'speedgate',
      id: item.id,
      w, h,
    } as UserData;
    return body;
  }

  static createSlowGate(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(item.x, item.y);
    const body = world.createRigidBody(desc);
    
    const w = item.w || 140;
    const h = 15;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    
    world.createCollider(colliderDesc, body);
    body.userData = {
      type: 'slowgate',
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
      .setRotation((item.angle ?? item.rotation ?? 0) * (Math.PI / 180));
    const body = world.createRigidBody(desc);
    
    // Ensure we have vertices
    const vertices = item.vertices || [
      { x: -50, y: -50 },
      { x: 50, y: -50 },
      { x: 50, y: 50 },
      { x: -50, y: 50 }
    ];

    // Create a polyline collider. Vertices must be a Float32Array of [x0, y0, x1, y1, ...]
    // Polyline needs an extra vertex at the end to close the loop
    const flatVertices = new Float32Array((vertices.length + 1) * 2);
    for (let i = 0; i < vertices.length; i++) {
      flatVertices[i * 2] = vertices[i].x;
      flatVertices[i * 2 + 1] = vertices[i].y;
    }
    // Close the loop
    flatVertices[vertices.length * 2] = vertices[0].x;
    flatVertices[vertices.length * 2 + 1] = vertices[0].y;
    
    // For now, let's create a polyline collider. It has no volume but stops objects.
    const colliderDesc = RAPIER.ColliderDesc.polyline(flatVertices)
      .setRestitution(item.restitution ?? 0.4)
      .setFriction(item.friction ?? 0.1);
      
    world.createCollider(colliderDesc, body);
    
    body.userData = {
      type: 'polygon',
      id: item.id,
      vertices: vertices,
    } as UserData;
    return body;
  }

  // ── 신규 장애물 10종 (docs/PRD-new-obstacles.md) ──────────────────────────

  /**
   * 필드 존(conveyor/sticky/zerog/heavyg): 충돌 이벤트 없이 SimulationCore가
   * 매 프레임 OBB 포함 검사로 효과를 적용한다(송풍기 applyWindCannons 방식).
   * 센서 콜라이더는 시각적 디버그/일관성용이며 이벤트를 발생시키지 않는다.
   */
  static createFieldZone(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(item.x, item.y)
      .setRotation((item.angle ?? item.rotation ?? 0) * (Math.PI / 180));
    const body = world.createRigidBody(desc);

    const w = item.w || 160;
    const h = item.h || (item.type === 'conveyor' ? 24 : 120);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2).setSensor(true);
    world.createCollider(colliderDesc, body);

    const userData: any = { type: item.type, id: item.id, w, h };
    if (item.type === 'conveyor') {
      // speed: 벨트 목표 접선 속도(px/s). 음수면 로컬 -x 방향으로 운송.
      userData.speed = item.speed ?? 250;
    } else if (item.type === 'sticky') {
      // force: 초당 감쇠율(점성). 4 → 종단 낙하속도 ≈ 중력/4 ≈ 37px/s
      userData.force = item.force ?? 4;
    } else if (item.type === 'heavyg') {
      // force: 중력 배율(gravityScale 목표값)
      userData.force = item.force ?? 2.5;
    }
    body.userData = userData as UserData;
    return body;
  }

  /** 지뢰: 접촉 트리거 센서(소형) + 광역 폭발 반경(radius)/강도(force)는 userData 로 전달 */
  static createMine(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(item.x, item.y);
    const body = world.createRigidBody(desc);
    // 트리거 반경은 기물 시각 크기(고정 22px). radius 는 "폭발 반경"으로 별도 저장.
    const colliderDesc = RAPIER.ColliderDesc.ball(22)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    world.createCollider(colliderDesc, body);
    body.userData = {
      type: 'mine',
      id: item.id,
      radius: item.radius || 140, // 폭발 반경
      force: item.force ?? 6,     // 폭발 강도(레벨)
    } as UserData;
    return body;
  }

  /** 캐논: 입구 센서 진입 시 포획 → 충전 후 지정 각도(0°=위, 부스터와 동일 규약)로 발사 */
  static createCannon(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(item.x, item.y)
      .setRotation((item.angle ?? item.rotation ?? 0) * (Math.PI / 180));
    const body = world.createRigidBody(desc);
    const colliderDesc = RAPIER.ColliderDesc.ball(30)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    world.createCollider(colliderDesc, body);
    body.userData = {
      type: 'cannon',
      id: item.id,
      rotation: item.angle ?? item.rotation ?? 0, // 발사 방향(도)
      power: item.power ?? 4,                     // 발사 속도 레벨
    } as UserData;
    return body;
  }

  /** 함정문: 평소 단단한 바닥. SimulationCore가 onFrames/offFrames 주기로 콜라이더를 토글한다. */
  static createTrapdoor(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(item.x, item.y)
      .setRotation((item.angle ?? item.rotation ?? 0) * (Math.PI / 180));
    const body = world.createRigidBody(desc);
    const w = item.w || 120;
    const h = item.h || 16;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2)
      .setRestitution(0.1)
      .setFriction(0.6);
    world.createCollider(colliderDesc, body);
    body.userData = {
      type: 'trapdoor',
      id: item.id,
      w, h,
      onFrames: item.onFrames || 180,  // 닫힘(단단함) 지속
      offFrames: item.offFrames || 90, // 열림(통과) 지속
    } as UserData;
    return body;
  }

  /** 빙판 지대: friction≈0 정적 표면 — 물리 재질만으로 동작(코어 이펙트 불필요) */
  static createIceRink(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(item.x, item.y)
      .setRotation((item.angle ?? item.rotation ?? 0) * (Math.PI / 180));
    const body = world.createRigidBody(desc);
    const w = item.w || 180;
    const h = item.h || 16;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2)
      .setRestitution(item.restitution ?? 0.05)
      .setFriction(0.0);
    world.createCollider(colliderDesc, body);
    body.userData = { type: 'icerink', id: item.id, w, h } as UserData;
    return body;
  }

  /**
   * 진자 파괴추: 바디는 피벗(item.x, item.y)에 고정되고 추 콜라이더는 로컬 (0, length)에
   * 오프셋(플리퍼의 오프셋 콜라이더 패턴). 회전만으로 진자 호를 그린다 →
   * OBSTACLE_FRAME 위치(피벗 고정)+회전 브로드캐스트로 시각·물리 완전 동기.
   */
  static createPendulum(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.kinematicVelocityBased()
      .setTranslation(item.x, item.y)
      .setCcdEnabled(true); // 고속 스윙 관통 방지(풍차와 동일)
    const body = world.createRigidBody(desc);

    const length = item.length || 140;
    const bobR = item.radius || 24;
    const colliderDesc = RAPIER.ColliderDesc.ball(bobR)
      .setTranslation(0, length)
      .setRestitution(0.8)
      .setFriction(0.2);
    world.createCollider(colliderDesc, body);

    body.userData = {
      type: 'pendulum',
      id: item.id,
      radius: bobR,
      length,
      swingAngle: item.swingAngle ?? 60, // 진폭(도)
      speed: item.speed || 2,            // 스윙 속도
    } as UserData;
    return body;
  }

  /** 초신성 펄사: 고정 중심에서 주기적으로 광역 방사형 충격파(위치 스캔형 — 이벤트 불필요) */
  static createSupernova(world: RAPIER.World, item: any) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(item.x, item.y);
    const body = world.createRigidBody(desc);
    const radius = item.radius || 200;
    const colliderDesc = RAPIER.ColliderDesc.ball(radius).setSensor(true);
    world.createCollider(colliderDesc, body);
    body.userData = {
      type: 'supernova',
      id: item.id,
      radius,
      force: item.force ?? 6,          // 충격파 강도(레벨)
      onFrames: item.onFrames || 150,  // 충전(텔레그래프) 시간
      offFrames: item.offFrames || 30, // 휴지 시간
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
