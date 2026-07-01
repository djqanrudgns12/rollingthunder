// 외벽 지오메트리의 단일 소스(SSOT).
// 물리(MapBuilder.createWalls)와 에디터/미니맵 렌더가 이 순수 모듈을 공유하여
// "게임에 실제로 생성되는 외벽"과 "에디터가 그리는 외벽"이 픽셀 단위로 일치하게 한다.
// PIXI/RAPIER 의존이 없어 워커·Node 하네스·React 에디터 어디서나 import 가능.

// 외벽 스타일: 맵마다 다른 외벽 형태를 지정하여 시각적·물리적 다양성 확보
export type WallStyle =
  | 'straight' | 'zigzag' | 'narrow' | 'wide' | 'funnel'
  | 'hourglass' | 'diamond' | 'wave' | 'sawtooth' | 'asymmetric';

export interface WallSegment {
  id: string;
  type: 'wall';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;      // 도(degree) 단위 — 데이터 정규 단위와 동일
  restitution: number;
  friction: number;
}

// y 위치별 외벽의 안쪽 오프셋/기울기(도)를 계산. (기존 MapBuilder/StageChrome 의 중복 구현을 통합)
export function getWallTransform(y: number, height: number, style: WallStyle) {
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

// 외벽을 구성하는 좌/우 벽 세그먼트 목록을 반환.
// MapBuilder.createWalls 와 완전히 동일한 좌표계/파라미터(-500 ~ height+500, step 100, thickness×100)를 사용한다.
export function computeWallSegments(
  width: number,
  worldHeight: number,
  thickness = 100,
  style: WallStyle = 'straight'
): WallSegment[] {
  const segments: WallSegment[] = [];
  const startY = -500;              // BG_PAD_TOP 과 정합
  const endY = worldHeight + 500;   // BG_PAD_BOTTOM 근사
  const step = 100;

  for (let y = startY; y <= endY; y += step) {
    const { leftOffset, rightOffset, leftAngle, rightAngle } = getWallTransform(y, worldHeight, style);
    segments.push({
      id: `wall_l_${y}`, type: 'wall',
      x: -thickness / 2 + leftOffset, y, w: thickness, h: 100,
      rotation: leftAngle, restitution: 0.2, friction: 0.05,
    });
    segments.push({
      id: `wall_r_${y}`, type: 'wall',
      x: width + thickness / 2 - rightOffset, y, w: thickness, h: 100,
      rotation: rightAngle, restitution: 0.2, friction: 0.05,
    });
  }
  return segments;
}
