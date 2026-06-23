import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

export class MapBuilder {
  static createRect(world: RAPIER.World, x: number, y: number, w: number, h: number, type: 'wall') {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    
    // Rapier의 cuboid는 half-extents (폭/높이의 절반) 값을 인자로 받음
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2)
      .setRestitution(0.2)
      .setFriction(0.5);

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

  static createPin(world: RAPIER.World, x: number, y: number, radius: number, isBumper = false) {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    
    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setRestitution(isBumper ? 1.8 : 0.4) // 범퍼는 맞으면 강하게 튕겨나감
      .setFriction(0.1);

    world.createCollider(colliderDesc, rigidBody);
    const userData: UserData = { type: isBumper ? 'bumper' : 'pin', radius };
    rigidBody.userData = userData;
    return rigidBody;
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
