/**
 * skinDefinitions.ts — v2 (퀄리티 대폭 개선)
 *
 * 왜 v2인가:
 * v1은 복잡한 베지어 곡선으로 동물/탈것을 그려서 36px에서 형태가 뭉개졌음.
 * v2는 "복합 도형(Composite Shapes)" 접근법 — 단순 도형(원, 타원, 삼각형)을
 * 겹쳐서 실루엣을 구성하여 작은 크기에서도 명확히 인식 가능.
 *
 * 디자인 원칙:
 * 1. 36px에서 한눈에 뭔지 알아야 함
 * 2. 핵심 특징을 2배 과장 (고양이 귀, 토끼 귀, 강아지 늘어진 귀 등)
 * 3. 컷아웃은 눈·코 정도만 (수염·미세 패턴은 36px에서 안 보이므로 제거)
 * 4. 캔버스 영역의 70~80%를 균일하게 채움
 */

type DrawFunction = (ctx: CanvasRenderingContext2D, r: number) => void;

export interface SkinDefinition {
  id: string;
  name: string;
  spin: boolean;
  scale?: number;
  draw: DrawFunction;
}

// ============================================================
// 헬퍼 함수
// ============================================================

/** 컷아웃 모드 시작 (이후 그리는 모든 것이 기존 픽셀을 지움) */
function beginCutout(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
}

/** 컷아웃 모드 종료 */
function endCutout(ctx: CanvasRenderingContext2D) {
  ctx.restore();
}

/** 원 채우기 */
function fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** 타원 채우기 */
function fillEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fill();
}

/** 삼각형 채우기 */
function fillTriangle(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

/** 둥근 직사각형 채우기 (다리 등에 사용) */
function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();
}

// ============================================================
// 포커칩 — 5종 변형
// ============================================================

/**
 * 포커칩 공통 외곽: 원 + 8개 노치 + 내부 링
 * 모든 칩 변형이 공유하는 베이스 형태
 */
function drawChipOuter(ctx: CanvasRenderingContext2D, r: number) {
  // 외곽 원
  fillCircle(ctx, 0, 0, r * 0.82);

  // 8개 엣지 노치 컷아웃 (포커칩 특유의 가장자리 홈)
  beginCutout(ctx);
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.fillRect(-r * 0.055, r * 0.64, r * 0.11, r * 0.2);
    ctx.restore();
  }
  endCutout(ctx);

  // 내부 링 갭 컷아웃
  beginCutout(ctx);
  fillCircle(ctx, 0, 0, r * 0.55);
  endCutout(ctx);

  // 내부 원 채움 (링 안쪽)
  fillCircle(ctx, 0, 0, r * 0.48);
}

/** V1: 중앙 별(★) 컷아웃 */
const drawChipBase1: DrawFunction = (ctx, r) => {
  drawChipOuter(ctx, r);
  beginCutout(ctx);
  const starR = r * 0.22;
  const innerR = r * 0.09;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 5;
    if (i === 0) ctx.moveTo(Math.cos(outerAngle) * starR, Math.sin(outerAngle) * starR);
    else ctx.lineTo(Math.cos(outerAngle) * starR, Math.sin(outerAngle) * starR);
    ctx.lineTo(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
  }
  ctx.closePath();
  ctx.fill();
  endCutout(ctx);
};

/** V2: 중앙 다이아몬드(◆) 컷아웃 */
const drawChipBase2: DrawFunction = (ctx, r) => {
  drawChipOuter(ctx, r);
  beginCutout(ctx);
  const d = r * 0.22;
  ctx.beginPath();
  ctx.moveTo(0, -d);
  ctx.lineTo(d * 0.7, 0);
  ctx.lineTo(0, d);
  ctx.lineTo(-d * 0.7, 0);
  ctx.closePath();
  ctx.fill();
  endCutout(ctx);
};

/** V3: 중앙 십자(✚) 컷아웃 */
const drawChipBase3: DrawFunction = (ctx, r) => {
  drawChipOuter(ctx, r);
  beginCutout(ctx);
  const arm = r * 0.2;
  const thick = r * 0.08;
  ctx.fillRect(-arm, -thick, arm * 2, thick * 2);
  ctx.fillRect(-thick, -arm, thick * 2, arm * 2);
  endCutout(ctx);
};

/** V4: 중앙 하트(♥) 컷아웃 */
const drawChipBase4: DrawFunction = (ctx, r) => {
  drawChipOuter(ctx, r);
  beginCutout(ctx);
  const s = r * 0.12;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.3);
  ctx.bezierCurveTo(-s * 0.5, -s * 1.5, -s * 2, -s * 0.8, 0, s * 1.2);
  ctx.bezierCurveTo(s * 2, -s * 0.8, s * 0.5, -s * 1.5, 0, -s * 0.3);
  ctx.closePath();
  ctx.fill();
  endCutout(ctx);
};

/** V5: 중앙 큰 원(●) 컷아웃 */
const drawChipBase5: DrawFunction = (ctx, r) => {
  drawChipOuter(ctx, r);
  beginCutout(ctx);
  fillCircle(ctx, 0, 0, r * 0.18);
  endCutout(ctx);
};

// ============================================================
// 경주마 — 복합 도형으로 질주하는 말 측면 실루엣
// ============================================================

/**
 * 디자인 참고: 페라리 로고 말 (우측 질주)
 * 접근법: 몸통(타원) + 목(사다리꼴) + 머리(타원) + 다리(회전 직사각형)
 *        을 겹쳐서 자연스러운 말 실루엣 구성
 */
const drawHorse: DrawFunction = (ctx, r) => {
  // 1. 몸통 — 큰 수평 타원 (배럴 형태)
  fillEllipse(ctx, -r * 0.05, r * 0.02, r * 0.33, r * 0.19);

  // 2. 목 — 몸통 전면에서 머리쪽으로 아치형 연결
  ctx.beginPath();
  ctx.moveTo(r * 0.18, -r * 0.1);
  ctx.quadraticCurveTo(r * 0.28, -r * 0.35, r * 0.22, -r * 0.48);
  ctx.lineTo(r * 0.12, -r * 0.42);
  ctx.quadraticCurveTo(r * 0.12, -r * 0.25, r * 0.06, -r * 0.08);
  ctx.closePath();
  ctx.fill();

  // 3. 머리 — 긴 타원 (살짝 아래로 기울임, 말 특유의 긴 두상)
  ctx.save();
  ctx.translate(r * 0.34, -r * 0.44);
  ctx.rotate(0.25);
  fillEllipse(ctx, 0, 0, r * 0.17, r * 0.08);
  ctx.restore();

  // 4. 귀 — 머리 위 작은 삼각형 2개
  fillTriangle(ctx, r * 0.22, -r * 0.48, r * 0.2, -r * 0.62, r * 0.27, -r * 0.5);
  fillTriangle(ctx, r * 0.28, -r * 0.49, r * 0.27, -r * 0.6, r * 0.33, -r * 0.5);

  // 5. 갈기 — 목 뒷면을 따라 흐르는 곡선 형태
  ctx.beginPath();
  ctx.moveTo(r * 0.24, -r * 0.5);
  ctx.bezierCurveTo(r * 0.17, -r * 0.43, r * 0.1, -r * 0.3, r * 0.04, -r * 0.14);
  ctx.bezierCurveTo(r * 0.1, -r * 0.28, r * 0.16, -r * 0.42, r * 0.22, -r * 0.49);
  ctx.closePath();
  ctx.fill();

  // 6. 앞다리 1 (앞으로 뻗음 — 질주 포즈)
  ctx.save();
  ctx.translate(r * 0.16, r * 0.16);
  ctx.rotate(-0.3);
  fillRoundRect(ctx, -r * 0.04, 0, r * 0.08, r * 0.33, r * 0.02);
  ctx.restore();

  // 7. 앞다리 2 (약간 뒤)
  ctx.save();
  ctx.translate(r * 0.06, r * 0.17);
  ctx.rotate(0.12);
  fillRoundRect(ctx, -r * 0.035, 0, r * 0.07, r * 0.3, r * 0.02);
  ctx.restore();

  // 8. 뒷다리 1 (뒤로 뻗음)
  ctx.save();
  ctx.translate(-r * 0.25, r * 0.13);
  ctx.rotate(0.25);
  fillRoundRect(ctx, -r * 0.04, 0, r * 0.08, r * 0.33, r * 0.02);
  ctx.restore();

  // 9. 뒷다리 2
  ctx.save();
  ctx.translate(-r * 0.18, r * 0.16);
  ctx.rotate(-0.1);
  fillRoundRect(ctx, -r * 0.035, 0, r * 0.07, r * 0.28, r * 0.02);
  ctx.restore();

  // 10. 꼬리 — 뒤쪽으로 흐르는 곡선
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.08);
  ctx.bezierCurveTo(-r * 0.48, -r * 0.12, -r * 0.58, -r * 0.28, -r * 0.52, -r * 0.45);
  ctx.bezierCurveTo(-r * 0.5, -r * 0.35, -r * 0.45, -r * 0.18, -r * 0.37, -r * 0.08);
  ctx.closePath();
  ctx.fill();

  // 11. 눈 컷아웃 (측면이므로 1개)
  beginCutout(ctx);
  fillCircle(ctx, r * 0.38, -r * 0.42, r * 0.025);
  endCutout(ctx);
};

// ============================================================
// 우주선 — 클래식 레트로 로켓 (위를 향함)
// ============================================================

const drawSpaceship: DrawFunction = (ctx, r) => {
  // 동체 — 곡선 노즈콘이 있는 세로 형태
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, r * 0.3);
  ctx.lineTo(-r * 0.15, -r * 0.15);
  ctx.bezierCurveTo(-r * 0.15, -r * 0.45, 0, -r * 0.72, 0, -r * 0.72);
  ctx.bezierCurveTo(0, -r * 0.72, r * 0.15, -r * 0.45, r * 0.15, -r * 0.15);
  ctx.lineTo(r * 0.15, r * 0.3);
  ctx.closePath();
  ctx.fill();

  // 좌측 삼각 날개핀
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, r * 0.08);
  ctx.lineTo(-r * 0.42, r * 0.45);
  ctx.lineTo(-r * 0.35, r * 0.45);
  ctx.lineTo(-r * 0.15, r * 0.28);
  ctx.closePath();
  ctx.fill();

  // 우측 삼각 날개핀
  ctx.beginPath();
  ctx.moveTo(r * 0.15, r * 0.08);
  ctx.lineTo(r * 0.42, r * 0.45);
  ctx.lineTo(r * 0.35, r * 0.45);
  ctx.lineTo(r * 0.15, r * 0.28);
  ctx.closePath();
  ctx.fill();

  // 배기 노즐 (동체 하단 사다리꼴)
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, r * 0.3);
  ctx.lineTo(-r * 0.18, r * 0.48);
  ctx.lineTo(r * 0.18, r * 0.48);
  ctx.lineTo(r * 0.12, r * 0.3);
  ctx.closePath();
  ctx.fill();

  // 컷아웃: 창문(원형) + 노즐 내부
  beginCutout(ctx);
  fillCircle(ctx, 0, -r * 0.18, r * 0.07);
  fillEllipse(ctx, 0, r * 0.4, r * 0.08, r * 0.04);
  endCutout(ctx);
};

// ============================================================
// 표창 — 4각 별 (직선 엣지, 날카로운 느낌)
// ============================================================

const drawShuriken: DrawFunction = (ctx, r) => {
  const outerR = r * 0.82;
  const innerR = r * 0.22;

  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const outerAngle = (i * Math.PI) / 2 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 4;
    if (i === 0) {
      ctx.moveTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
    } else {
      ctx.lineTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
    }
    ctx.lineTo(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
  }
  ctx.closePath();
  ctx.fill();

  // 중앙 구멍 컷아웃
  beginCutout(ctx);
  fillCircle(ctx, 0, 0, r * 0.08);
  endCutout(ctx);
};

// ============================================================
// 축구공 — 원형 + 간결한 오각형 패턴
// ============================================================

const drawSoccerball: DrawFunction = (ctx, r) => {
  fillCircle(ctx, 0, 0, r * 0.8);

  // 컷아웃: 중앙 오각형 + 5방사선 (36px에서도 보이는 최소 패턴)
  beginCutout(ctx);
  const pentR = r * 0.22;
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

  // 오각형 꼭짓점 → 바깥 방사선 5개
  ctx.lineWidth = r * 0.04;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * pentR, Math.sin(angle) * pentR);
    ctx.lineTo(Math.cos(angle) * r * 0.68, Math.sin(angle) * r * 0.68);
    ctx.stroke();
  }
  endCutout(ctx);
};

// ============================================================
// 체리 — 두 알 + 줄기 + 잎
// ============================================================

const drawCherry: DrawFunction = (ctx, r) => {
  // 두 알 (큰 원 2개)
  fillCircle(ctx, -r * 0.24, r * 0.18, r * 0.3);
  fillCircle(ctx, r * 0.24, r * 0.08, r * 0.3);

  // 줄기 (두꺼운 곡선)
  ctx.lineWidth = r * 0.065;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.02);
  ctx.bezierCurveTo(-r * 0.08, -r * 0.3, r * 0.02, -r * 0.48, r * 0.12, -r * 0.52);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(r * 0.16, -r * 0.12);
  ctx.bezierCurveTo(r * 0.14, -r * 0.35, r * 0.12, -r * 0.48, r * 0.12, -r * 0.52);
  ctx.stroke();

  // 잎 (줄기 꼭대기에 작은 잎사귀)
  ctx.beginPath();
  ctx.moveTo(r * 0.12, -r * 0.52);
  ctx.bezierCurveTo(r * 0.22, -r * 0.58, r * 0.38, -r * 0.52, r * 0.32, -r * 0.44);
  ctx.bezierCurveTo(r * 0.26, -r * 0.46, r * 0.18, -r * 0.5, r * 0.12, -r * 0.52);
  ctx.closePath();
  ctx.fill();
};

// ============================================================
// 스포츠카 — 측면 실루엣
// ============================================================

const drawCar: DrawFunction = (ctx, r) => {
  // 차체 (범퍼→후드→지붕→트렁크 일체형 경로)
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, r * 0.08);
  ctx.bezierCurveTo(-r * 0.58, 0, -r * 0.52, -r * 0.06, -r * 0.42, -r * 0.08);
  ctx.lineTo(-r * 0.15, -r * 0.1);
  ctx.lineTo(-r * 0.06, -r * 0.35);
  ctx.lineTo(r * 0.2, -r * 0.37);
  ctx.lineTo(r * 0.36, -r * 0.1);
  ctx.lineTo(r * 0.52, -r * 0.08);
  ctx.bezierCurveTo(r * 0.58, -r * 0.04, r * 0.58, r * 0.04, r * 0.55, r * 0.08);
  // 하부 — 뒷바퀴 아치
  ctx.lineTo(r * 0.46, r * 0.08);
  ctx.arc(r * 0.36, r * 0.08, r * 0.1, 0, Math.PI, false);
  ctx.lineTo(r * 0.26, r * 0.08);
  ctx.lineTo(-r * 0.26, r * 0.08);
  // 하부 — 앞바퀴 아치
  ctx.arc(-r * 0.36, r * 0.08, r * 0.1, 0, Math.PI, false);
  ctx.lineTo(-r * 0.46, r * 0.08);
  ctx.closePath();
  ctx.fill();

  // 바퀴
  fillCircle(ctx, -r * 0.36, r * 0.14, r * 0.1);
  fillCircle(ctx, r * 0.36, r * 0.14, r * 0.1);

  // 컷아웃: 바퀴 허브 + 창문
  beginCutout(ctx);
  fillCircle(ctx, -r * 0.36, r * 0.14, r * 0.04);
  fillCircle(ctx, r * 0.36, r * 0.14, r * 0.04);
  // 앞 창문
  fillTriangle(ctx, -r * 0.1, -r * 0.32, -r * 0.03, -r * 0.12, -r * 0.13, -r * 0.12);
  // 뒷 창문
  ctx.beginPath();
  ctx.moveTo(r * 0.01, -r * 0.32);
  ctx.lineTo(r * 0.18, -r * 0.33);
  ctx.lineTo(r * 0.32, -r * 0.12);
  ctx.lineTo(r * 0.01, -r * 0.12);
  ctx.closePath();
  ctx.fill();
  endCutout(ctx);
};

// ============================================================
// 새 — 측면 비행 실루엣 (트위터 새 스타일)
// ============================================================

/**
 * v1 문제: 정면 뷰 → 날개가 사람 팔처럼 보여 "저승사자" 형태
 * v2 해법: 측면 비행 뷰. 둥근 몸 + 곡선 날개 + 뾰족한 부리 → 즉시 "새"로 인식
 */
const drawBird: DrawFunction = (ctx, r) => {
  // 몸통 (둥근 타원)
  fillEllipse(ctx, 0, r * 0.1, r * 0.28, r * 0.2);

  // 머리 (몸통 우상단에 겹치는 원)
  fillCircle(ctx, r * 0.24, -r * 0.08, r * 0.16);

  // 부리 (삼각형, 우측 돌출)
  fillTriangle(ctx,
    r * 0.37, -r * 0.12,
    r * 0.55, -r * 0.05,
    r * 0.37, r * 0.02
  );

  // 날개 (위로 펼친 곡선 — 핵심 식별 포인트)
  ctx.beginPath();
  ctx.moveTo(-r * 0.08, r * 0.0);
  ctx.bezierCurveTo(-r * 0.35, -r * 0.2, -r * 0.3, -r * 0.55, r * 0.0, -r * 0.52);
  ctx.bezierCurveTo(r * 0.15, -r * 0.5, r * 0.12, -r * 0.3, r * 0.08, -r * 0.08);
  ctx.closePath();
  ctx.fill();

  // 꼬리깃 (좌측으로 2갈래 팬)
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, r * 0.05);
  ctx.lineTo(-r * 0.55, -r * 0.12);
  ctx.lineTo(-r * 0.33, r * 0.08);
  ctx.lineTo(-r * 0.55, r * 0.12);
  ctx.lineTo(-r * 0.3, r * 0.2);
  ctx.closePath();
  ctx.fill();

  // 눈 컷아웃 (측면이므로 1개)
  beginCutout(ctx);
  fillCircle(ctx, r * 0.3, -r * 0.12, r * 0.04);
  endCutout(ctx);
};

// ============================================================
// 네잎클로버 — 4개 하트형 잎 (줄기 없음, 36px 최적화)
// ============================================================

const drawClover: DrawFunction = (ctx, r) => {
  // 4방향 하트잎: 각 잎 = 두 원(하트 상단) + 삼각형(중앙까지 연결)
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    fillCircle(ctx, -r * 0.13, -r * 0.35, r * 0.17);
    fillCircle(ctx, r * 0.13, -r * 0.35, r * 0.17);
    fillTriangle(ctx, -r * 0.28, -r * 0.3, r * 0.28, -r * 0.3, 0, -r * 0.05);
    ctx.restore();
  }
};

// ============================================================
// 고양이 — 정면 얼굴 (뾰족한 귀 강조)
// ============================================================

const drawCat: DrawFunction = (ctx, r) => {
  // 머리 (둥근 원)
  fillCircle(ctx, 0, r * 0.08, r * 0.45);

  // 좌측 귀 (크고 뾰족한 삼각형 — 핵심 식별 포인트)
  fillTriangle(ctx,
    -r * 0.42, -r * 0.08,
    -r * 0.24, -r * 0.68,
    -r * 0.06, -r * 0.2
  );
  // 우측 귀
  fillTriangle(ctx,
    r * 0.06, -r * 0.2,
    r * 0.24, -r * 0.68,
    r * 0.42, -r * 0.08
  );

  // 컷아웃: 귀 안쪽 + 아몬드 눈 + 코
  beginCutout(ctx);
  // 귀 안쪽 (작은 삼각형)
  fillTriangle(ctx, -r * 0.35, -r * 0.1, -r * 0.24, -r * 0.52, -r * 0.13, -r * 0.2);
  fillTriangle(ctx, r * 0.13, -r * 0.2, r * 0.24, -r * 0.52, r * 0.35, -r * 0.1);
  // 눈 (아몬드형 — 고양이 특유의 눈)
  fillEllipse(ctx, -r * 0.18, r * 0.0, r * 0.09, r * 0.065, -0.1);
  fillEllipse(ctx, r * 0.18, r * 0.0, r * 0.09, r * 0.065, 0.1);
  // 코 (작은 역삼각형)
  fillTriangle(ctx, -r * 0.04, r * 0.16, r * 0.04, r * 0.16, 0, r * 0.22);
  endCutout(ctx);
};

// ============================================================
// 강아지 — 정면 얼굴 (늘어진 귀 강조)
// ============================================================

/**
 * v1 문제: 귀가 위로 솟아 E.T.처럼 보임
 * v2 해법: 귀가 양옆으로 축 늘어진 플로피 귀 (강아지 핵심 식별 포인트)
 */
const drawDog: DrawFunction = (ctx, r) => {
  // 머리 (큰 원)
  fillCircle(ctx, 0, -r * 0.05, r * 0.42);

  // 좌측 늘어진 귀 (세로 긴 타원, 양옆에서 아래로 드리움)
  fillEllipse(ctx, -r * 0.45, r * 0.08, r * 0.14, r * 0.32, 0.15);
  // 우측 늘어진 귀
  fillEllipse(ctx, r * 0.45, r * 0.08, r * 0.14, r * 0.32, -0.15);

  // 주둥이 (머리 하단에 살짝 튀어나온 타원)
  fillEllipse(ctx, 0, r * 0.18, r * 0.2, r * 0.16);

  // 컷아웃: 눈 + 큰 코
  beginCutout(ctx);
  fillCircle(ctx, -r * 0.16, -r * 0.1, r * 0.07);
  fillCircle(ctx, r * 0.16, -r * 0.1, r * 0.07);
  // 코 (큰 둥근 코 — 강아지 특유)
  fillEllipse(ctx, 0, r * 0.1, r * 0.09, r * 0.065);
  endCutout(ctx);
};

// ============================================================
// 블랙홀 — 원형 + 동심원 링 컷아웃
// ============================================================

const drawBlackhole: DrawFunction = (ctx, r) => {
  fillCircle(ctx, 0, 0, r * 0.85);

  beginCutout(ctx);
  ctx.lineWidth = r * 0.06;
  ctx.strokeStyle = 'white';
  // 외곽 링
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  // 내부 링
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  // 중앙 구멍
  fillCircle(ctx, 0, 0, r * 0.15);
  endCutout(ctx);
};

// ============================================================
// 다이아몬드 — 보석 형태 (넓은 비율)
// ============================================================

const drawDiamond: DrawFunction = (ctx, r) => {
  // 크라운 (사다리꼴 — 상단)
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, -r * 0.1);
  ctx.lineTo(-r * 0.3, -r * 0.5);
  ctx.lineTo(r * 0.3, -r * 0.5);
  ctx.lineTo(r * 0.55, -r * 0.1);
  ctx.closePath();
  ctx.fill();

  // 파빌리온 (역삼각형 — 하단)
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, -r * 0.1);
  ctx.lineTo(r * 0.55, -r * 0.1);
  ctx.lineTo(0, r * 0.65);
  ctx.closePath();
  ctx.fill();

  // 면 분할선 컷아웃
  beginCutout(ctx);
  ctx.lineWidth = r * 0.025;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'butt';
  // 크라운-파빌리온 경계선
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, -r * 0.1);
  ctx.lineTo(r * 0.55, -r * 0.1);
  ctx.stroke();
  // 크라운 세로선
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.5);
  ctx.lineTo(-r * 0.15, -r * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.15, -r * 0.5);
  ctx.lineTo(r * 0.15, -r * 0.1);
  ctx.stroke();
  // 파빌리온 대각선
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.1);
  ctx.lineTo(0, r * 0.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.15, -r * 0.1);
  ctx.lineTo(0, r * 0.65);
  ctx.stroke();
  endCutout(ctx);
};

// ============================================================
// 토끼 — 정면 얼굴 (매우 긴 귀)
// ============================================================

const drawRabbit: DrawFunction = (ctx, r) => {
  // 머리 (원형)
  fillCircle(ctx, 0, r * 0.15, r * 0.4);

  // 좌측 긴 귀 (세로로 매우 긴 타원 — 핵심 식별 포인트)
  fillEllipse(ctx, -r * 0.18, -r * 0.38, r * 0.1, r * 0.38);
  // 우측 긴 귀
  fillEllipse(ctx, r * 0.18, -r * 0.38, r * 0.1, r * 0.38);

  // 컷아웃: 귀 안쪽 + 눈 + 코 + 앞니
  beginCutout(ctx);
  // 귀 안쪽 (가늘고 긴 타원)
  fillEllipse(ctx, -r * 0.18, -r * 0.38, r * 0.05, r * 0.28);
  fillEllipse(ctx, r * 0.18, -r * 0.38, r * 0.05, r * 0.28);
  // 눈
  fillCircle(ctx, -r * 0.15, r * 0.08, r * 0.06);
  fillCircle(ctx, r * 0.15, r * 0.08, r * 0.06);
  // 코 (작은 타원)
  fillEllipse(ctx, 0, r * 0.22, r * 0.05, r * 0.035);
  // 앞니 (2개 작은 직사각형 — 토끼 특유)
  ctx.fillRect(-r * 0.045, r * 0.26, r * 0.038, r * 0.09);
  ctx.fillRect(r * 0.007, r * 0.26, r * 0.038, r * 0.09);
  endCutout(ctx);
};

// ============================================================
// 거북이 — 위에서 본 실루엣 (돔형 등딱지)
// ============================================================

/**
 * v1 문제: 등딱지 패턴이 깨지고 다리 위치 부자연스러움
 * v2 해법: 큰 원형 등딱지 + 명확한 다리 방향 + 단순한 육각형 패턴
 */
const drawTurtle: DrawFunction = (ctx, r) => {
  // 등딱지 (큰 원)
  fillCircle(ctx, 0, -r * 0.02, r * 0.42);

  // 머리 (우측 돌출 원)
  fillCircle(ctx, r * 0.5, -r * 0.02, r * 0.14);

  // 4개 다리 (대각선 방향의 작은 타원)
  fillEllipse(ctx, r * 0.3, -r * 0.32, r * 0.13, r * 0.08, -0.7);   // 우상
  fillEllipse(ctx, r * 0.3, r * 0.28, r * 0.13, r * 0.08, 0.7);    // 우하
  fillEllipse(ctx, -r * 0.3, -r * 0.32, r * 0.13, r * 0.08, 0.7);  // 좌상
  fillEllipse(ctx, -r * 0.3, r * 0.28, r * 0.13, r * 0.08, -0.7);  // 좌하

  // 꼬리 (좌측 작은 삼각형)
  fillTriangle(ctx, -r * 0.42, -r * 0.02, -r * 0.58, r * 0.02, -r * 0.42, r * 0.06);

  // 등딱지 패턴 + 눈 컷아웃
  beginCutout(ctx);
  ctx.lineWidth = r * 0.03;
  ctx.strokeStyle = 'white';

  // 중앙 육각형 (크고 선명)
  const hexR = r * 0.2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const hx = Math.cos(angle) * hexR;
    const hy = -r * 0.02 + Math.sin(angle) * hexR;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.stroke();

  // 육각형 꼭짓점 → 등딱지 가장자리 연결선
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * hexR, -r * 0.02 + Math.sin(angle) * hexR);
    ctx.lineTo(Math.cos(angle) * r * 0.36, -r * 0.02 + Math.sin(angle) * r * 0.36);
    ctx.stroke();
  }

  // 눈
  fillCircle(ctx, r * 0.53, -r * 0.05, r * 0.03);
  endCutout(ctx);
};

// ============================================================
// 전체 스킨 정의 맵 (총 19개 엔트리)
// ============================================================

export const SKIN_DEFINITIONS: Record<string, SkinDefinition> = {
  // === 포커칩 5종 변형 (기본 보유, spin: true) ===
  chip_base_1: { id: 'chip_base_1', name: '포커칩 ★', spin: true, draw: drawChipBase1 },
  chip_base_2: { id: 'chip_base_2', name: '포커칩 ◆', spin: true, draw: drawChipBase2 },
  chip_base_3: { id: 'chip_base_3', name: '포커칩 ✚', spin: true, draw: drawChipBase3 },
  chip_base_4: { id: 'chip_base_4', name: '포커칩 ♥', spin: true, draw: drawChipBase4 },
  chip_base_5: { id: 'chip_base_5', name: '포커칩 ●', spin: true, draw: drawChipBase5 },

  // === 기본 보유 (2종, spin: false) ===
  horse:     { id: 'horse',     name: '경주마',     spin: false, draw: drawHorse },
  spaceship: { id: 'spaceship', name: '우주선',     spin: false, draw: drawSpaceship },

  // === Normal (12종) ===
  shuriken:   { id: 'shuriken',   name: '표창',       spin: true,  draw: drawShuriken },
  soccerball: { id: 'soccerball', name: '축구공',     spin: true,  draw: drawSoccerball },
  cherry:     { id: 'cherry',     name: '체리',       spin: false, draw: drawCherry },
  car:        { id: 'car',        name: '스포츠카',   spin: false, draw: drawCar },
  bird:       { id: 'bird',       name: '새',         spin: false, draw: drawBird },
  clover:     { id: 'clover',     name: '네잎클로버', spin: true,  draw: drawClover },
  cat:        { id: 'cat',        name: '고양이',     spin: false, draw: drawCat },
  blackhole:  { id: 'blackhole',  name: '블랙홀',     spin: true,  draw: drawBlackhole },
  dog:        { id: 'dog',        name: '강아지',     spin: false, draw: drawDog },
  diamond:    { id: 'diamond',    name: '다이아몬드', spin: true,  draw: drawDiamond },
  rabbit:     { id: 'rabbit',     name: '토끼',       spin: false, draw: drawRabbit },
  turtle:     { id: 'turtle',     name: '거북이',     spin: false, draw: drawTurtle },
};
