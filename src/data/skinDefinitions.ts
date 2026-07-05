/**
 * skinDefinitions.ts
 * 
 * 왜 이렇게 만들었나:
 * 기존 PNG 에셋(2~8KB 극저해상도)은 인게임에서 픽셀이 깨지고, 검은 배경이 표시되는 문제가 있었음.
 * Canvas 2D API로 직접 그리면 해상도와 무관하게 항상 선명하고, 투명 배경이 자동 보장됨.
 * PixiJS의 sprite.tint = 참가자색상 시스템과 100% 호환.
 * 
 * 구조:
 * - draw() 함수는 Canvas 2D 컨텍스트에 "흰색 실루엣"을 그림
 * - SkinTextureFactory가 이 결과물을 PIXI.Texture로 변환
 * - PhysicsCanvas에서 tint를 적용하면 흰색→참가자 색상으로 치환됨
 * - 내부 디테일(눈, 코 등)은 destination-out 합성으로 "투명 컷아웃" 처리
 */

// 드로잉 함수 타입: ctx는 캔버스 중앙이 원점(0,0)으로 이동된 상태, r은 반지름(128)
type DrawFunction = (ctx: CanvasRenderingContext2D, r: number) => void;

export interface SkinDefinition {
  id: string;
  name: string;
  spin: boolean;    // true: 속도에 따라 구름, false: 항상 정방향 유지
  scale?: number;   // 기본 1.0, 필요시 스케일 조정
  draw: DrawFunction;
}

// ============================
// 헬퍼 함수들
// ============================

/** 내부 디테일을 투명하게 잘라내는 컷아웃 모드 시작 */
function beginCutout(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
}

/** 컷아웃 모드 종료, 기본 합성으로 복원 */
function endCutout(ctx: CanvasRenderingContext2D) {
  ctx.restore();
}

/** 원 그리기 (흰색 채움) */
function fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** 타원 그리기 (흰색 채움) */
function fillEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fill();
}

/** 삼각형 그리기 */
function fillTriangle(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

// ============================
// 15종 스킨 드로잉 함수
// ============================

/** 포커칩: 원형 + 내부 링 + 중앙 별 패턴 */
const drawChipBase: DrawFunction = (ctx, r) => {
  // 외곽 원
  fillCircle(ctx, 0, 0, r * 0.85);

  // 내부 링 패턴 (컷아웃으로 고급스러운 칩 느낌)
  beginCutout(ctx);
  fillCircle(ctx, 0, 0, r * 0.72);
  endCutout(ctx);

  // 내부 채움 링
  fillCircle(ctx, 0, 0, r * 0.65);

  beginCutout(ctx);
  fillCircle(ctx, 0, 0, r * 0.45);
  endCutout(ctx);

  // 중앙 원
  fillCircle(ctx, 0, 0, r * 0.38);

  // 외곽 장식 노치 (8방향 직사각형 컷아웃 — 포커칩 특유의 홈)
  beginCutout(ctx);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const cx = Math.cos(angle) * r * 0.785;
    const cy = Math.sin(angle) * r * 0.785;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillRect(-r * 0.06, -r * 0.12, r * 0.12, r * 0.24);
    ctx.restore();
  }
  endCutout(ctx);
};

/** 경주마: 달리는 말 측면 실루엣 */
const drawHorse: DrawFunction = (ctx, r) => {
  const s = r * 0.016; // 스케일 단위
  ctx.beginPath();
  // 몸통 (타원형 베이스)
  ctx.moveTo(-30 * s, -10 * s);
  // 머리 쪽 목
  ctx.bezierCurveTo(-25 * s, -35 * s, -15 * s, -55 * s, -5 * s, -60 * s);
  // 머리 윗부분
  ctx.bezierCurveTo(0 * s, -62 * s, 10 * s, -60 * s, 15 * s, -55 * s);
  // 머리 앞면 (코)
  ctx.bezierCurveTo(20 * s, -50 * s, 22 * s, -45 * s, 18 * s, -40 * s);
  // 턱
  ctx.bezierCurveTo(14 * s, -35 * s, 5 * s, -35 * s, 0 * s, -30 * s);
  // 목에서 등으로
  ctx.bezierCurveTo(-8 * s, -20 * s, -15 * s, -15 * s, -15 * s, -5 * s);
  // 등
  ctx.bezierCurveTo(-15 * s, 0, 15 * s, -5 * s, 30 * s, -5 * s);
  // 엉덩이
  ctx.bezierCurveTo(40 * s, -5 * s, 45 * s, 0, 42 * s, 10 * s);
  // 뒷다리 1
  ctx.bezierCurveTo(40 * s, 25 * s, 45 * s, 45 * s, 42 * s, 55 * s);
  ctx.bezierCurveTo(41 * s, 58 * s, 38 * s, 58 * s, 37 * s, 55 * s);
  ctx.bezierCurveTo(35 * s, 45 * s, 33 * s, 30 * s, 30 * s, 20 * s);
  // 뒷다리 2
  ctx.bezierCurveTo(28 * s, 30 * s, 30 * s, 45 * s, 28 * s, 55 * s);
  ctx.bezierCurveTo(27 * s, 58 * s, 24 * s, 58 * s, 23 * s, 55 * s);
  ctx.bezierCurveTo(22 * s, 45 * s, 20 * s, 30 * s, 15 * s, 15 * s);
  // 배
  ctx.bezierCurveTo(5 * s, 12 * s, -10 * s, 12 * s, -15 * s, 15 * s);
  // 앞다리 1
  ctx.bezierCurveTo(-18 * s, 30 * s, -15 * s, 45 * s, -17 * s, 55 * s);
  ctx.bezierCurveTo(-18 * s, 58 * s, -21 * s, 58 * s, -22 * s, 55 * s);
  ctx.bezierCurveTo(-23 * s, 45 * s, -25 * s, 30 * s, -25 * s, 20 * s);
  // 앞다리 2
  ctx.bezierCurveTo(-28 * s, 30 * s, -28 * s, 45 * s, -30 * s, 55 * s);
  ctx.bezierCurveTo(-31 * s, 58 * s, -34 * s, 58 * s, -35 * s, 55 * s);
  ctx.bezierCurveTo(-36 * s, 45 * s, -38 * s, 25 * s, -35 * s, 10 * s);
  // 가슴으로 복귀
  ctx.bezierCurveTo(-35 * s, 0, -33 * s, -5 * s, -30 * s, -10 * s);
  ctx.closePath();
  ctx.fill();

  // 귀 (삼각형)
  fillTriangle(ctx, -2 * s, -60 * s, 2 * s, -72 * s, 8 * s, -58 * s);

  // 꼬리 (곡선)
  ctx.beginPath();
  ctx.moveTo(42 * s, 5 * s);
  ctx.bezierCurveTo(50 * s, -5 * s, 55 * s, -15 * s, 48 * s, -25 * s);
  ctx.bezierCurveTo(52 * s, -15 * s, 48 * s, -5 * s, 45 * s, 8 * s);
  ctx.closePath();
  ctx.fill();
};

/** 우주선: 로켓 형태 (위를 향함) */
const drawSpaceship: DrawFunction = (ctx, r) => {
  const s = r * 0.018;
  ctx.beginPath();
  // 노즈콘 (뾰족한 상단)
  ctx.moveTo(0, -50 * s);
  ctx.bezierCurveTo(5 * s, -45 * s, 12 * s, -30 * s, 14 * s, -10 * s);
  // 우측 동체
  ctx.lineTo(14 * s, 20 * s);
  // 우측 날개
  ctx.lineTo(30 * s, 40 * s);
  ctx.lineTo(28 * s, 45 * s);
  ctx.lineTo(16 * s, 32 * s);
  // 우측 하단
  ctx.lineTo(16 * s, 38 * s);
  ctx.lineTo(10 * s, 45 * s);
  // 노즐 하단
  ctx.lineTo(10 * s, 50 * s);
  ctx.lineTo(-10 * s, 50 * s);
  // 좌측 하단
  ctx.lineTo(-10 * s, 45 * s);
  ctx.lineTo(-16 * s, 38 * s);
  // 좌측 날개
  ctx.lineTo(-16 * s, 32 * s);
  ctx.lineTo(-28 * s, 45 * s);
  ctx.lineTo(-30 * s, 40 * s);
  ctx.lineTo(-14 * s, 20 * s);
  // 좌측 동체
  ctx.lineTo(-14 * s, -10 * s);
  ctx.bezierCurveTo(-12 * s, -30 * s, -5 * s, -45 * s, 0, -50 * s);
  ctx.closePath();
  ctx.fill();

  // 창문 컷아웃 (원형)
  beginCutout(ctx);
  fillCircle(ctx, 0, -15 * s, 6 * s);
  endCutout(ctx);

  // 엔진 노즐 컷아웃 (불꽃 구멍)
  beginCutout(ctx);
  ctx.fillRect(-5 * s, 42 * s, 10 * s, 8 * s);
  endCutout(ctx);
};

/** 표창: 4방향 방사형 닌자 스타 */
const drawShuriken: DrawFunction = (ctx, r) => {
  const outerR = r * 0.85;
  const innerR = r * 0.25;
  const points = 4;
  
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = (i * Math.PI * 2) / points - Math.PI / 2;
    const nextAngle = ((i + 1) * Math.PI * 2) / points - Math.PI / 2;
    const midAngle = angle + Math.PI / points;
    
    // 뾰족한 꼭짓점 (외곽)
    const outerX = Math.cos(angle) * outerR;
    const outerY = Math.sin(angle) * outerR;
    // 안쪽 오목한 부분
    const innerX = Math.cos(midAngle) * innerR;
    const innerY = Math.sin(midAngle) * innerR;
    
    if (i === 0) {
      ctx.moveTo(outerX, outerY);
    } else {
      ctx.lineTo(outerX, outerY);
    }
    // 날에 살짝 커브를 줘서 회전감 표현
    const ctrlAngle = midAngle - 0.3;
    const ctrlR = r * 0.5;
    ctx.quadraticCurveTo(
      Math.cos(ctrlAngle) * ctrlR,
      Math.sin(ctrlAngle) * ctrlR,
      innerX, innerY
    );
  }
  ctx.closePath();
  ctx.fill();

  // 중앙 원 컷아웃 (표창 구멍)
  beginCutout(ctx);
  fillCircle(ctx, 0, 0, r * 0.12);
  endCutout(ctx);
};

/** 축구공: 원형 + 오각형 패턴 */
const drawSoccerball: DrawFunction = (ctx, r) => {
  // 외곽 원
  fillCircle(ctx, 0, 0, r * 0.85);

  // 오각형 패턴 컷아웃 (축구공 특유의 검은 패치)
  beginCutout(ctx);
  
  // 중앙 오각형
  const pentR = r * 0.25;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const px = Math.cos(angle) * pentR;
    const py = Math.sin(angle) * pentR;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // 주변 오각형 5개 (바깥쪽)
  for (let i = 0; i < 5; i++) {
    const centerAngle = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const cx = Math.cos(centerAngle) * r * 0.58;
    const cy = Math.sin(centerAngle) * r * 0.58;
    const smallR = r * 0.15;
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const angle = (j * Math.PI * 2) / 5 - Math.PI / 2 + centerAngle;
      const px = cx + Math.cos(angle) * smallR;
      const py = cy + Math.sin(angle) * smallR;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  endCutout(ctx);
};

/** 체리: 두 알의 체리 + 줄기 */
const drawCherry: DrawFunction = (ctx, r) => {
  // 좌측 체리 알
  fillCircle(ctx, -r * 0.28, r * 0.18, r * 0.35);
  // 우측 체리 알
  fillCircle(ctx, r * 0.28, r * 0.08, r * 0.35);

  // 줄기 (곡선)
  ctx.beginPath();
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'round';
  // 좌측 줄기
  ctx.moveTo(-r * 0.2, -r * 0.05);
  ctx.bezierCurveTo(-r * 0.1, -r * 0.45, r * 0.05, -r * 0.65, r * 0.15, -r * 0.7);
  ctx.stroke();
  // 우측 줄기
  ctx.beginPath();
  ctx.moveTo(r * 0.25, -r * 0.15);
  ctx.bezierCurveTo(r * 0.2, -r * 0.45, r * 0.15, -r * 0.6, r * 0.15, -r * 0.7);
  ctx.stroke();

  // 잎 (작은 타원)
  ctx.save();
  ctx.translate(r * 0.15, -r * 0.7);
  ctx.rotate(0.5);
  fillEllipse(ctx, r * 0.1, -r * 0.02, r * 0.18, r * 0.08);
  ctx.restore();

  // 하이라이트 컷아웃 (광택 점)
  beginCutout(ctx);
  fillCircle(ctx, -r * 0.38, r * 0.05, r * 0.07);
  fillCircle(ctx, r * 0.18, -r * 0.05, r * 0.07);
  endCutout(ctx);
};

/** 스포츠카: 측면 실루엣 */
const drawCar: DrawFunction = (ctx, r) => {
  const s = r * 0.018;
  ctx.beginPath();
  // 차체 하단 (좌→우)
  ctx.moveTo(-42 * s, 12 * s);
  // 앞 범퍼
  ctx.lineTo(-45 * s, 5 * s);
  ctx.bezierCurveTo(-45 * s, -2 * s, -40 * s, -5 * s, -35 * s, -5 * s);
  // 후드
  ctx.lineTo(-15 * s, -8 * s);
  // 앞 유리
  ctx.lineTo(-8 * s, -28 * s);
  // 루프
  ctx.lineTo(15 * s, -30 * s);
  // 뒷 유리
  ctx.lineTo(28 * s, -12 * s);
  // 트렁크
  ctx.lineTo(40 * s, -10 * s);
  // 뒷 범퍼
  ctx.bezierCurveTo(45 * s, -8 * s, 46 * s, 0, 45 * s, 5 * s);
  ctx.lineTo(44 * s, 12 * s);
  // 뒷바퀴 위 아치
  ctx.bezierCurveTo(40 * s, 5 * s, 30 * s, 5 * s, 26 * s, 12 * s);
  // 바닥
  ctx.lineTo(-20 * s, 12 * s);
  // 앞바퀴 위 아치
  ctx.bezierCurveTo(-24 * s, 5 * s, -34 * s, 5 * s, -38 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  // 앞바퀴
  fillCircle(ctx, -30 * s, 15 * s, 8 * s);
  // 뒷바퀴
  fillCircle(ctx, 33 * s, 15 * s, 8 * s);

  // 바퀴 허브 컷아웃
  beginCutout(ctx);
  fillCircle(ctx, -30 * s, 15 * s, 3.5 * s);
  fillCircle(ctx, 33 * s, 15 * s, 3.5 * s);
  endCutout(ctx);

  // 창문 컷아웃
  beginCutout(ctx);
  ctx.beginPath();
  ctx.moveTo(-5 * s, -25 * s);
  ctx.lineTo(-1 * s, -10 * s);
  ctx.lineTo(-12 * s, -10 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2 * s, -10 * s);
  ctx.lineTo(3 * s, -26 * s);
  ctx.lineTo(14 * s, -27 * s);
  ctx.lineTo(24 * s, -13 * s);
  ctx.lineTo(2 * s, -13 * s);
  ctx.closePath();
  ctx.fill();
  endCutout(ctx);
};

/** 새: 날개 펼친 독수리형 실루엣 (정면) */
const drawBird: DrawFunction = (ctx, r) => {
  const s = r * 0.017;
  ctx.beginPath();
  // 머리 (작은 원)
  ctx.arc(0, -30 * s, 12 * s, 0, Math.PI * 2);
  ctx.fill();

  // 몸통
  ctx.beginPath();
  ctx.moveTo(-10 * s, -20 * s);
  ctx.bezierCurveTo(-12 * s, 0, -10 * s, 20 * s, -5 * s, 35 * s);
  // 꼬리 좌
  ctx.lineTo(-12 * s, 48 * s);
  ctx.lineTo(0, 40 * s);
  ctx.lineTo(12 * s, 48 * s);
  // 꼬리 우
  ctx.lineTo(5 * s, 35 * s);
  ctx.bezierCurveTo(10 * s, 20 * s, 12 * s, 0, 10 * s, -20 * s);
  ctx.closePath();
  ctx.fill();

  // 좌측 날개
  ctx.beginPath();
  ctx.moveTo(-10 * s, -15 * s);
  ctx.bezierCurveTo(-25 * s, -25 * s, -45 * s, -15 * s, -55 * s, -30 * s);
  // 날개 끝 깃털
  ctx.lineTo(-50 * s, -25 * s);
  ctx.lineTo(-52 * s, -20 * s);
  ctx.lineTo(-48 * s, -18 * s);
  ctx.bezierCurveTo(-35 * s, -5 * s, -20 * s, 5 * s, -10 * s, 5 * s);
  ctx.closePath();
  ctx.fill();

  // 우측 날개 (좌측 대칭)
  ctx.beginPath();
  ctx.moveTo(10 * s, -15 * s);
  ctx.bezierCurveTo(25 * s, -25 * s, 45 * s, -15 * s, 55 * s, -30 * s);
  ctx.lineTo(50 * s, -25 * s);
  ctx.lineTo(52 * s, -20 * s);
  ctx.lineTo(48 * s, -18 * s);
  ctx.bezierCurveTo(35 * s, -5 * s, 20 * s, 5 * s, 10 * s, 5 * s);
  ctx.closePath();
  ctx.fill();

  // 부리 (작은 삼각형)
  fillTriangle(ctx, -3 * s, -28 * s, 3 * s, -28 * s, 0, -22 * s);

  // 눈 컷아웃
  beginCutout(ctx);
  fillCircle(ctx, -5 * s, -33 * s, 2.5 * s);
  fillCircle(ctx, 5 * s, -33 * s, 2.5 * s);
  endCutout(ctx);
};

/** 네잎클로버: 4개의 하트형 잎 + 줄기 */
const drawClover: DrawFunction = (ctx, r) => {
  // 4개의 하트형 잎 (90도 간격)
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);

    // 하트 형태의 잎 (위쪽 방향)
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.05);
    // 우측 반원
    ctx.bezierCurveTo(
      r * 0.25, -r * 0.45,
      r * 0.55, -r * 0.35,
      r * 0.3, -r * 0.05
    );
    // 하단 뾰족한 부분
    ctx.bezierCurveTo(r * 0.15, r * 0.1, r * 0.05, r * 0.05, 0, -r * 0.05);
    // 좌측 반원
    ctx.bezierCurveTo(
      -r * 0.05, r * 0.05,
      -r * 0.15, r * 0.1,
      -r * 0.3, -r * 0.05
    );
    ctx.bezierCurveTo(
      -r * 0.55, -r * 0.35,
      -r * 0.25, -r * 0.45,
      0, -r * 0.05
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 줄기
  ctx.beginPath();
  ctx.lineWidth = r * 0.07;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'round';
  ctx.moveTo(0, r * 0.05);
  ctx.bezierCurveTo(r * 0.05, r * 0.35, r * 0.1, r * 0.55, r * 0.05, r * 0.75);
  ctx.stroke();
};

/** 고양이: 정면 얼굴 (귀, 눈, 코, 수염) */
const drawCat: DrawFunction = (ctx, r) => {
  // 머리 (원형)
  fillCircle(ctx, 0, r * 0.05, r * 0.58);

  // 좌측 귀 (삼각형)
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.2);
  ctx.lineTo(-r * 0.32, -r * 0.72);
  ctx.lineTo(-r * 0.08, -r * 0.35);
  ctx.closePath();
  ctx.fill();

  // 우측 귀
  ctx.beginPath();
  ctx.moveTo(r * 0.5, -r * 0.2);
  ctx.lineTo(r * 0.32, -r * 0.72);
  ctx.lineTo(r * 0.08, -r * 0.35);
  ctx.closePath();
  ctx.fill();

  // 내부 디테일 컷아웃 (눈, 코, 입, 수염, 귀 안쪽)
  beginCutout(ctx);

  // 귀 안쪽 삼각형
  fillTriangle(ctx, -r * 0.42, -r * 0.25, -r * 0.32, -r * 0.58, -r * 0.15, -r * 0.33);
  fillTriangle(ctx, r * 0.42, -r * 0.25, r * 0.32, -r * 0.58, r * 0.15, -r * 0.33);

  // 눈 (아몬드형 타원)
  fillEllipse(ctx, -r * 0.22, -r * 0.05, r * 0.1, r * 0.12);
  fillEllipse(ctx, r * 0.22, -r * 0.05, r * 0.1, r * 0.12);

  // 코 (역삼각형)
  fillTriangle(ctx, -r * 0.06, r * 0.12, r * 0.06, r * 0.12, 0, r * 0.2);

  // 입 (Y자 라인)
  ctx.lineWidth = r * 0.035;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.2);
  ctx.lineTo(0, r * 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, r * 0.28);
  ctx.bezierCurveTo(-r * 0.05, r * 0.33, -r * 0.1, r * 0.35, -r * 0.13, r * 0.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, r * 0.28);
  ctx.bezierCurveTo(r * 0.05, r * 0.33, r * 0.1, r * 0.35, r * 0.13, r * 0.32);
  ctx.stroke();

  // 수염 (좌 3개)
  ctx.lineWidth = r * 0.02;
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, r * 0.15);
  ctx.lineTo(-r * 0.5, r * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, r * 0.2);
  ctx.lineTo(-r * 0.5, r * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, r * 0.25);
  ctx.lineTo(-r * 0.5, r * 0.32);
  ctx.stroke();

  // 수염 (우 3개)
  ctx.beginPath();
  ctx.moveTo(r * 0.15, r * 0.15);
  ctx.lineTo(r * 0.5, r * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.15, r * 0.2);
  ctx.lineTo(r * 0.5, r * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.15, r * 0.25);
  ctx.lineTo(r * 0.5, r * 0.32);
  ctx.stroke();

  endCutout(ctx);
};

/** 강아지: 정면 얼굴 (접힌 귀, 혀) */
const drawDog: DrawFunction = (ctx, r) => {
  // 머리 (원형)
  fillCircle(ctx, 0, 0, r * 0.55);

  // 좌측 접힌 귀 (둥근 삼각형)
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, -r * 0.3);
  ctx.bezierCurveTo(-r * 0.7, -r * 0.25, -r * 0.72, r * 0.15, -r * 0.5, r * 0.25);
  ctx.bezierCurveTo(-r * 0.4, r * 0.15, -r * 0.35, 0, -r * 0.38, -r * 0.15);
  ctx.closePath();
  ctx.fill();

  // 우측 접힌 귀
  ctx.beginPath();
  ctx.moveTo(r * 0.42, -r * 0.3);
  ctx.bezierCurveTo(r * 0.7, -r * 0.25, r * 0.72, r * 0.15, r * 0.5, r * 0.25);
  ctx.bezierCurveTo(r * 0.4, r * 0.15, r * 0.35, 0, r * 0.38, -r * 0.15);
  ctx.closePath();
  ctx.fill();

  // 주둥이 (타원)
  fillEllipse(ctx, 0, r * 0.18, r * 0.25, r * 0.2);

  // 디테일 컷아웃
  beginCutout(ctx);

  // 눈
  fillCircle(ctx, -r * 0.2, -r * 0.1, r * 0.09);
  fillCircle(ctx, r * 0.2, -r * 0.1, r * 0.09);

  // 코 (둥근 역삼각)
  fillEllipse(ctx, 0, r * 0.08, r * 0.1, r * 0.07);

  // 입 라인
  ctx.lineWidth = r * 0.035;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.14);
  ctx.lineTo(0, r * 0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, r * 0.22, r * 0.08, 0, Math.PI);
  ctx.stroke();

  endCutout(ctx);

  // 혀 (주둥이 아래 돌출, 입 컷아웃 위에 다시 그림)
  fillEllipse(ctx, 0, r * 0.38, r * 0.07, r * 0.1);
};

/** 블랙홀: 소용돌이 형태 */
const drawBlackhole: DrawFunction = (ctx, r) => {
  // 외곽 원
  fillCircle(ctx, 0, 0, r * 0.85);

  // 소용돌이 패턴 컷아웃 (나선형 홈)
  beginCutout(ctx);

  // 여러 겹의 나선형 아크로 소용돌이 표현
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'round';

  for (let ring = 0; ring < 4; ring++) {
    const startRadius = r * (0.15 + ring * 0.17);
    const endRadius = r * (0.25 + ring * 0.17);
    ctx.beginPath();
    const startAngle = ring * 1.2;
    const endAngle = startAngle + Math.PI * 1.3;
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + t * (endAngle - startAngle);
      const radius = startRadius + t * (endRadius - startRadius);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 중앙 구멍
  fillCircle(ctx, 0, 0, r * 0.12);
  endCutout(ctx);
};

/** 다이아몬드: 보석 형태 (상단 삼각 + 하단 역삼각) */
const drawDiamond: DrawFunction = (ctx, r) => {
  // 상단 크라운 (사다리꼴)
  ctx.beginPath();
  ctx.moveTo(-r * 0.65, -r * 0.15);
  ctx.lineTo(-r * 0.35, -r * 0.65);
  ctx.lineTo(r * 0.35, -r * 0.65);
  ctx.lineTo(r * 0.65, -r * 0.15);
  ctx.closePath();
  ctx.fill();

  // 하단 파빌리온 (역삼각형)
  ctx.beginPath();
  ctx.moveTo(-r * 0.65, -r * 0.15);
  ctx.lineTo(r * 0.65, -r * 0.15);
  ctx.lineTo(0, r * 0.75);
  ctx.closePath();
  ctx.fill();

  // 내부 컷 라인 (보석의 면 분할선)
  beginCutout(ctx);
  ctx.lineWidth = r * 0.03;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'round';

  // 크라운 가로선
  ctx.beginPath();
  ctx.moveTo(-r * 0.65, -r * 0.15);
  ctx.lineTo(r * 0.65, -r * 0.15);
  ctx.stroke();

  // 크라운 세로 분할
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.65);
  ctx.lineTo(-r * 0.2, -r * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.65);
  ctx.lineTo(0, -r * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.35, -r * 0.65);
  ctx.lineTo(r * 0.2, -r * 0.15);
  ctx.stroke();

  // 파빌리온 대각선
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.15);
  ctx.lineTo(0, r * 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.2, -r * 0.15);
  ctx.lineTo(0, r * 0.75);
  ctx.stroke();

  endCutout(ctx);
};

/** 토끼: 정면 얼굴 (긴 귀) */
const drawRabbit: DrawFunction = (ctx, r) => {
  // 머리 (원형)
  fillCircle(ctx, 0, r * 0.12, r * 0.5);

  // 좌측 긴 귀 (둥근 직사각형)
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, -r * 0.15);
  ctx.bezierCurveTo(-r * 0.35, -r * 0.4, -r * 0.32, -r * 0.8, -r * 0.2, -r * 0.88);
  ctx.bezierCurveTo(-r * 0.1, -r * 0.92, -r * 0.05, -r * 0.8, -r * 0.08, -r * 0.4);
  ctx.bezierCurveTo(-r * 0.1, -r * 0.2, -r * 0.15, -r * 0.15, -r * 0.18, -r * 0.1);
  ctx.closePath();
  ctx.fill();

  // 우측 긴 귀
  ctx.beginPath();
  ctx.moveTo(r * 0.28, -r * 0.15);
  ctx.bezierCurveTo(r * 0.35, -r * 0.4, r * 0.32, -r * 0.8, r * 0.2, -r * 0.88);
  ctx.bezierCurveTo(r * 0.1, -r * 0.92, r * 0.05, -r * 0.8, r * 0.08, -r * 0.4);
  ctx.bezierCurveTo(r * 0.1, -r * 0.2, r * 0.15, -r * 0.15, r * 0.18, -r * 0.1);
  ctx.closePath();
  ctx.fill();

  // 디테일 컷아웃
  beginCutout(ctx);

  // 귀 안쪽 (작은 타원)
  fillEllipse(ctx, -r * 0.2, -r * 0.55, r * 0.07, r * 0.22);
  fillEllipse(ctx, r * 0.2, -r * 0.55, r * 0.07, r * 0.22);

  // 눈 (큰 둥근 눈)
  fillCircle(ctx, -r * 0.18, r * 0.03, r * 0.09);
  fillCircle(ctx, r * 0.18, r * 0.03, r * 0.09);

  // 코 (작은 타원)
  fillEllipse(ctx, 0, r * 0.2, r * 0.06, r * 0.04);

  // 입 (Y자)
  ctx.lineWidth = r * 0.03;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.23);
  ctx.lineTo(0, r * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, r * 0.3);
  ctx.bezierCurveTo(-r * 0.03, r * 0.35, -r * 0.08, r * 0.36, -r * 0.1, r * 0.34);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, r * 0.3);
  ctx.bezierCurveTo(r * 0.03, r * 0.35, r * 0.08, r * 0.36, r * 0.1, r * 0.34);
  ctx.stroke();

  endCutout(ctx);
};

/** 거북이: 측면 실루엣 (둥근 등껍질) */
const drawTurtle: DrawFunction = (ctx, r) => {
  // 등껍질 (큰 반원)
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r * 0.55, r * 0.5, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // 배 (하단 타원)
  fillEllipse(ctx, 0, r * 0.12, r * 0.5, r * 0.15);

  // 머리 (우측으로 돌출)
  ctx.beginPath();
  ctx.moveTo(r * 0.45, -r * 0.05);
  ctx.bezierCurveTo(r * 0.6, -r * 0.15, r * 0.75, -r * 0.12, r * 0.75, 0);
  ctx.bezierCurveTo(r * 0.75, r * 0.1, r * 0.65, r * 0.15, r * 0.5, r * 0.1);
  ctx.closePath();
  ctx.fill();

  // 앞발
  fillEllipse(ctx, r * 0.35, r * 0.28, r * 0.15, r * 0.07, -0.4);
  // 뒷발
  fillEllipse(ctx, -r * 0.35, r * 0.28, r * 0.15, r * 0.07, 0.4);

  // 꼬리 (좌측 작은 삼각)
  fillTriangle(ctx, -r * 0.5, r * 0.05, -r * 0.68, r * 0.02, -r * 0.55, r * 0.15);

  // 등껍질 육각형 패턴 컷아웃
  beginCutout(ctx);

  // 중앙 육각형
  const hexR = r * 0.18;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    const hx = Math.cos(angle) * hexR;
    const hy = -r * 0.15 + Math.sin(angle) * hexR;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.stroke();
  // 내부 라인용 stroke 설정
  ctx.lineWidth = r * 0.025;
  ctx.strokeStyle = 'white';
  ctx.stroke();

  // 작은 사이드 패턴
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    const cx = Math.cos(angle) * hexR * 1.3;
    const cy = -r * 0.15 + Math.sin(angle) * hexR * 1.0;
    // 등껍질 영역 내에서만 표시
    if (cy < r * 0.05) {
      fillCircle(ctx, cx, cy, r * 0.04);
    }
  }

  // 눈
  fillCircle(ctx, r * 0.67, -r * 0.05, r * 0.035);

  endCutout(ctx);
};

// ============================
// 전체 스킨 정의 맵
// ============================
export const SKIN_DEFINITIONS: Record<string, SkinDefinition> = {
  // 기본 보유 (Default) — 3종
  chip_base_1: { id: 'chip_base_1', name: '포커칩',     spin: true,  draw: drawChipBase },
  horse:       { id: 'horse',       name: '경주마',     spin: false, draw: drawHorse },
  spaceship:   { id: 'spaceship',   name: '우주선',     spin: false, draw: drawSpaceship },

  // Normal — 12종
  shuriken:    { id: 'shuriken',    name: '표창',       spin: true,  draw: drawShuriken },
  soccerball:  { id: 'soccerball',  name: '축구공',     spin: true,  draw: drawSoccerball },
  cherry:      { id: 'cherry',      name: '체리',       spin: false, draw: drawCherry },
  car:         { id: 'car',         name: '스포츠카',   spin: false, draw: drawCar },
  bird:        { id: 'bird',        name: '새',         spin: false, draw: drawBird },
  clover:      { id: 'clover',      name: '네잎클로버', spin: true,  draw: drawClover },
  cat:         { id: 'cat',         name: '고양이',     spin: false, draw: drawCat },
  blackhole:   { id: 'blackhole',   name: '블랙홀',     spin: true,  draw: drawBlackhole },
  dog:         { id: 'dog',         name: '강아지',     spin: false, draw: drawDog },
  diamond:     { id: 'diamond',     name: '다이아몬드', spin: true,  draw: drawDiamond },
  rabbit:      { id: 'rabbit',      name: '토끼',       spin: false, draw: drawRabbit },
  turtle:      { id: 'turtle',      name: '거북이',     spin: false, draw: drawTurtle },
};
