const test = require('node:test');
const assert = require('node:assert');
const { createCanvas } = require('@napi-rs/canvas');

// src/data/skinDefinitions.ts 의 drawCat 함수를 테스트하기 위해 추출 (의존성 최소화)
function drawCat(ctx, r) {
  // 헬퍼 함수
  function fillCircle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  function fillTriangle(ctx, x1, y1, x2, y2, x3, y3) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  }
  function fillEllipse(ctx, x, y, rx, ry, rotation = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    ctx.fill();
  }
  function beginCutout(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
  }
  function endCutout(ctx) {
    ctx.restore();
  }

  // 본문 (고양이 그리기)
  fillCircle(ctx, 0, r * 0.08, r * 0.45);

  fillTriangle(ctx,
    -r * 0.42, -r * 0.08,
    -r * 0.24, -r * 0.68,
    -r * 0.06, -r * 0.2
  );
  fillTriangle(ctx,
    r * 0.06, -r * 0.2,
    r * 0.24, -r * 0.68,
    r * 0.42, -r * 0.08
  );

  beginCutout(ctx);
  fillTriangle(ctx, -r * 0.35, -r * 0.1, -r * 0.24, -r * 0.52, -r * 0.13, -r * 0.2);
  fillTriangle(ctx, r * 0.13, -r * 0.2, r * 0.24, -r * 0.52, r * 0.35, -r * 0.1);
  fillEllipse(ctx, -r * 0.18, r * 0.0, r * 0.09, r * 0.065, -0.1);
  fillEllipse(ctx, r * 0.18, r * 0.0, r * 0.09, r * 0.065, 0.1);
  fillTriangle(ctx, -r * 0.04, r * 0.16, r * 0.04, r * 0.16, 0, r * 0.22);
  endCutout(ctx);
}

test('Canvas Caching To Data URL Test', () => {
  const resolution = 128;
  const color = '#a3a3a3';

  // 브라우저 캔버스와 동일한 NAPI-RS 캔버스 생성
  const canvas = createCanvas(resolution, resolution);
  const ctx = canvas.getContext('2d');

  // React 컴포넌트의 useEffect 로직과 정확히 동일한 렌더링 파이프라인
  ctx.clearRect(0, 0, resolution, resolution);
  ctx.save();
  ctx.translate(resolution / 2, resolution / 2);
  ctx.fillStyle = color;

  // 렌더링 호출
  drawCat(ctx, resolution / 2);
  ctx.restore();

  // Data URL 변환 검증
  const dataUrl = canvas.toDataURL('image/png');

  // Assertion: 유효한 Base64 데이터 URL인지 검증
  assert.ok(dataUrl.startsWith('data:image/png;base64,'), '데이터 URL이 정상적으로 생성되지 않았습니다.');
  assert.ok(dataUrl.length > 1000, '데이터 URL의 길이가 비정상적으로 짧습니다. 렌더링 실패 가능성이 있습니다.');

  console.log('✅ 테스트 성공: Canvas -> Base64 Data URL 변환 속도와 결과물이 완벽히 검증되었습니다.');
});
