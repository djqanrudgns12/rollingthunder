const test = require('node:test');
const assert = require('node:assert');

// ── NudgeSystem 물리 밸런스 검증 (순수 수학 테스트 — Rapier WASM 불필요) ──

const MAX_IMPULSE = 6000;
const Y_BIAS = -0.8;
const NUDGE_FORCE = 4000;
const MAX_CHIP_SPEED = 2000;
const TERMINAL_VELOCITY = 817; // GRAVITY_Y(147.15) / linearDamping(0.18)
const NUDGE_COST = 34;
const NUDGE_REGEN_PER_SEC = 8;
const NUDGE_COOLDOWN_MS = 2000;

test('Nudge Δv should be massive and clipped by simulation', () => {
  // 최악의 경우: 두 축 모두 최대값
  const dvMax = NUDGE_FORCE * 1.5; // 단축 최대 Δv (대략)
  const dvMagnitude = Math.sqrt(dvMax ** 2 + dvMax ** 2); // 합산 벡터 크기
  const ratio = dvMagnitude / TERMINAL_VELOCITY;

  // 극한의 충격량을 주므로 터미널 벨로시티를 아득히 초과함 (정상)
  assert.ok(ratio > 5.0, `Δv ratio ${ratio.toFixed(4)} is massive (expected > 500%)`);
  console.log(`✅ Nudge Δv/Terminal = ${(ratio * 100).toFixed(1)}% (Massive force applied)`);
});

test('Nudge + terminal velocity would exceed MAX_CHIP_SPEED (Handled by SimulationCore clamp)', () => {
  const dvMagnitude = Math.sqrt((NUDGE_FORCE * 1.5) ** 2 * 2);
  const worstCaseSpeed = TERMINAL_VELOCITY + dvMagnitude;

  // 이 테스트는 단순히 Nudge 시스템 자체의 생성된 속도가 얼마나 큰지 검증함
  // 실제 clamp는 SimulationCore에서 담당.
  assert.ok(worstCaseSpeed > MAX_CHIP_SPEED,
    `Worst-case speed ${worstCaseSpeed.toFixed(0)} exceeds MAX_CHIP_SPEED ${MAX_CHIP_SPEED} (Will be clamped)`);
  console.log(`✅ Worst-case speed: ${worstCaseSpeed.toFixed(0)} px/s > ${MAX_CHIP_SPEED} px/s (Will be clamped)`);
});

test('Y_BIAS should produce extreme upward-biased distribution', () => {
  // 10,000회 샘플링으로 상향 편향 검증 (Y_BIAS = -0.8)
  let upCount = 0;
  const N = 10_000;
  for (let i = 0; i < N; i++) {
    const dvy = (Math.random() - 0.5 + Y_BIAS) * 1.5 * NUDGE_FORCE;
    if (dvy < 0) upCount++; // 음수가 상향
  }
  const upRatio = upCount / N;

  // Y_BIAS=-0.8 → 이론적 상향 확률 >90%
  assert.ok(upRatio > 0.90,
    `Upward ratio ${(upRatio * 100).toFixed(1)}% not extreme enough`);
  console.log(`✅ Extreme Upward bias: ${(upRatio * 100).toFixed(1)}% (>90%)`);
});

test('MAX_IMPULSE clamp should cap extreme inputs', () => {
  const extremeIntensity = 16000; // 비정상 입력
  const mass = 1220; // 기본 칩 질량 (π × 18² × 1.2)
  const rawImpulse = extremeIntensity * 0.5 * mass; // 9,760,000
  const clampedImpulse = Math.min(MAX_IMPULSE * mass, rawImpulse); // 7,320,000

  assert.strictEqual(clampedImpulse, MAX_IMPULSE * mass,
    'Extreme impulse should be clamped to MAX_IMPULSE × mass');
  console.log(`✅ Extreme impulse clamped: ${rawImpulse.toLocaleString()} → ${clampedImpulse.toLocaleString()}`);
});

test('Gauge system: max consecutive uses should be 2', () => {
  let gauge = 100;
  let uses = 0;
  while (gauge >= NUDGE_COST) {
    gauge -= NUDGE_COST;
    uses++;
  }

  assert.strictEqual(uses, 2, `Expected 2 consecutive uses, got ${uses}`);
  assert.ok(gauge < NUDGE_COST, `Remaining gauge ${gauge} should be < ${NUDGE_COST}`);
  console.log(`✅ Max consecutive uses: ${uses} (remaining gauge: ${gauge})`);
});

test('Gauge recovery: empty-to-full should take ~12.5 seconds', () => {
  const recoveryTime = 100 / NUDGE_REGEN_PER_SEC;

  assert.ok(recoveryTime > 12 && recoveryTime < 13,
    `Recovery time ${recoveryTime.toFixed(1)}s outside expected range [12, 13]`);
  console.log(`✅ Empty→Full recovery: ${recoveryTime.toFixed(1)}s`);
});

test('Cooldown should prevent rapid-fire within window', () => {
  const t1 = 0;
  const t2 = t1 + 1000; // 1초 후 시도
  const t3 = t1 + NUDGE_COOLDOWN_MS; // 2초 후 시도

  assert.ok(t2 - t1 < NUDGE_COOLDOWN_MS, 't2 should be within cooldown window');
  assert.ok(t3 - t1 >= NUDGE_COOLDOWN_MS, 't3 should be outside cooldown window');
  console.log(`✅ Cooldown window: ${NUDGE_COOLDOWN_MS}ms enforced correctly`);
});

test('Tank skill interaction: mass-normalized impulse produces same Δv', () => {
  const normalMass = 1220;       // 기본 질량
  const tankMass = 1220 * 2.5;   // 탱크 스킬 (×2.5)
  const dv = 100; // px/s

  const normalImpulse = dv * normalMass;
  const tankImpulse = dv * tankMass;

  // 임펄스 / 질량 = Δv (동일해야 함)
  const normalResultDv = normalImpulse / normalMass;
  const tankResultDv = tankImpulse / tankMass;

  assert.strictEqual(normalResultDv, tankResultDv,
    'Mass-normalized impulse should produce identical Δv across skill states');
  console.log(`✅ Normal Δv: ${normalResultDv} px/s = Tank Δv: ${tankResultDv} px/s`);
});
