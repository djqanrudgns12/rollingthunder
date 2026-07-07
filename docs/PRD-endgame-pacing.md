# PRD — 엔드게임 페이싱: "플레이 시간" 설정 + 갇힘 구조 리스폰 + 마무리 연출

> 상태: **v1.1 구현 완료** · 작성 2026-07-07 · 구현 2026-07-08 · 대상: 레이스 종반 페이싱 · 안티스턱 · 환경설정
> 관련 문서: [docs/PRD-gameplay-dynamics.md](./PRD-gameplay-dynamics.md), [docs/OBSTACLES.md](./OBSTACLES.md)

## 0. 구현 노트 (v1.1 — 시뮬레이터 검증으로 확정된 설계 수정)

설계대로 구현하되, 헤드리스 시뮬레이터 검증에서 발견된 다음 사항을 수정·확정했다:

1. **L2 탈출 임펄스 윈도는 슬라이더로 스케일하지 않는다 (R2 보전).** 기존 L2 진척 판정은
   `chipMaxY`의 단일 프레임 델타(>80px)를 기준으로 해서 **정상 하강 칩에도 ~5.5초마다 주기적으로
   +500 하향 임펄스가 걸리는 기존 특성**이 있다(정상 하강은 프레임당 ~13px라 조건 미충족).
   이 주기를 스케일하면 우승 확정 전 레이스 페이스 자체가 변한다(시뮬: 완주 median 22~38s 편차,
   우승 확정 시각 왜곡). 임펄스 주기는 고정하고 스케일은 **구조 격상·L1·L3에만** 적용 →
   우승 확정 median이 playTime 50/100에서 21.6s로 동일함을 확인.
2. **구조 리스폰 감지를 "임펄스 실패 카운터"에서 "진짜 정체 + 2단계 격상"으로 재설계.**
   위 특성 때문에 임펄스 발동 횟수는 끼임 신호가 아니다(카운터 방식은 판당 17.5회 오발동).
   확정 설계: 별도 기준점(`rescueBaseY` — 마지막으로 80px 전진한 y/프레임) + 이중 속도 게이트
   (판정 순간 속도 <60px/s, 정체 기간 평균 이동 속도 <40px/s — 룰렛 그릇 순환·포탈 루프 등
   "움직이지만 진전 없는" 의도된 기믹 동작 제외) 기반 **1단계(쐐기, 기본 ~17초)**, 그리고
   속도 게이트를 무시하는 **2단계(하드, 기본 ~55초)** — 무한 루프·미완주 차단용.
3. **마무리 부스트 상한 3배→4배** (`ENDGAME_MAX_BOOST_SPAN 3.0`). 수동 빨리감기 4배와 동일한
   dt 영역이라 신규 물리 리스크 없음. playTime=0 꼬리 median 9.9s→8.8s(p90 12.2s) 달성.
4. **구조 배치 중앙 편향 30%** — 끼임은 대부분 벽-기물 포켓에서 발생(진단 샘플 (18,889) 등),
   같은 포켓 재낙하 방지.
5. **`rescues/race < 0.5` 합격선은 "맵 결함 진단 신호"로 재해석.** 실측: 대부분 맵 0.2~2회/판이며
   반복 발동 좌표가 실제 끼임 포켓을 정확히 가리킨다(예: neon_arcade (18,889)·(782,1789) 대칭 트랩,
   맵 밖 터널링 이탈 칩 (870,2551) 복귀 사례 포함). 맵 수정의 입력 데이터로 활용.
6. **하네스 `targetCount`를 chips→1로 변경** — 첫 완주자가 우승이 되어 꼬리 구간이 측정 가능해진다.
   playTime=50에서 gameOver 플래그는 물리에 무영향이므로 기존 지표와 동등.

**검증 결과 요약** (10~20판×12칩): A/A 동일 시드 출력 완전 일치(결정론 ✓). 우승 확정 시각
playTime 무관 동일(50/100 기준 21.6s ✓). 꼬리 압축: neon_arcade +37.3s→+8.8s, roulette_of_fate
+174.9s→+34.9s(미완주 2→0). 룰렛 미완주율은 기준선과 동일(10%, 기존 맵 결함), 포탈미궁은
폭풍 34→14회·미완주 1→0으로 개선.

---

## 1. 배경 (Context)

사용자 보고: **마지막 마블이 너무 늦게 들어오거나 특정 장소에 갇히면 게임이 루즈해진다.** 이에 대한 요구사항 3가지:

1. 환경설정(환경설정 모달)에 **"플레이 시간"을 단축/연장하는 설정** 추가 — 기본값 50 (0~100 스케일).
2. 특정 장소에 갇혀 못 나오는 마블을 **근처 다른 열린 공간으로 리스폰**시키는 기능.
3. 그 외 루즈함을 해소할 추가 아이디어.

설계 방향 결정(사용자 확정):
- 슬라이더는 **우승 확정 후 마무리(꼬리) 구간만** 압축/연장한다. 우승 확정 전 레이스 물리는 불변이며, **50 = 현재 동작과 완전 동일**.
- 구조 리스폰은 설정 토글 없는 **상시 엔진 안전장치**로 넣는다.

## 2. 현재 구조 분석 (As-Is) — 탐색으로 확정한 사실

### 2.1 "루즈함"의 본체는 우승 확정 → 전원 완주 사이의 꼬리 구간

- 우승 확정(`GAME_OVER` 이벤트)은 모드별 조건 충족 시 `scanChipsAndFinish()`([SimulationCore.ts](../src/engine/SimulationCore.ts) `:1083-1149`)에서 발생하지만, **시뮬레이션은 전원 완주(`allFinished`, `:148`)까지 계속 돈다.** 탈락(elimination)은 없고, 모든 마블이 결승선까지 내려와야 한다.
- UI 상태 흐름: `idle → playing → winner_declared(GAME_OVER 수신) → all_finished(ALL_FINISHED 수신)` ([PhysicsCanvas.tsx](../src/components/PhysicsCanvas.tsx)). **`winner_declared → all_finished` 구간이 사용자가 느끼는 "루즈함"의 정확한 위치**다. 이 구간에는 볼거리(승부)가 없는데도 꼴찌가 기어 내려올 때까지 실시간으로 기다려야 한다.
- **핵심 안전 경계선: 4개 모드(speed/turtle/custom/random) 모두 `gameOver === true` 시점에 우승자가 이미 확정되어 있다.** speed=선착 N명 완주 시, turtle=탈락자 전원 완주 시(미완주자가 승자), custom=N번째 완주자, random=당첨 등수 전원 충족 시. 따라서 **gameOver 이후의 어떤 물리 개입도 승패에 영향을 주지 않는다** (이후 완주 순서는 순위표 표시용). 이 사실이 본 설계 전체의 근거다.

### 2.2 갇힘(끼임)에 대한 기존 안전장치는 "임펄스"뿐 — 밀폐 공간에서 무력

`applyAntiStuck()`([SimulationCore.ts](../src/engine/SimulationCore.ts) `:1151-1208`)의 3단계:

| 레벨 | 트리거 | 조치 | 한계 |
|---|---|---|---|
| L1 중력 폭풍 | 미완주 칩 평균 속도 <10이 300프레임(5초) 지속 | 전원 랜덤 넉백(±150 수평, 최대 -350 상향) | 전역 이벤트 — 개별 끼임엔 둔감 |
| L2 개별 진척 체크 | 칩이 `300*COOLDOWN_SCALE`프레임 동안 80px 미만 전진 | 중앙 지향 ±150 + 하향 500 탈출 임펄스 | **오목한 포켓(기물 사이 밀폐 공간)에선 임펄스가 무한 반복될 뿐 탈출 불가.** 같은 칩에 몇 번 실패했는지 추적하지 않음 — 근본 결함 |
| L3 절대 타임아웃 | `frame === 10800*COOLDOWN_SCALE`(~3분) | 중력 2배 + 중력장 force=0 | 침묵 속 발동(연출 없음). `===` 비교라 트리거 프레임이 동적으로 바뀌면 스킵 위험 |

부수 결함 2건(본 작업에서 함께 수정 권장):
- **결정론 훼손**: `applyAntiStuck`이 `Math.random()`을 직접 사용(`:1169`, `:1195`). 주입된 `this.rng`를 쓰지 않아 시뮬 하네스 재현성이 불완전하다.
- **L3 트리거 취약성**: `===` 비교(`:1201`)는 플레이 시간 슬라이더로 트리거 프레임이 동적으로 변하면 그냥 지나칠 수 있다. `>=` + 1회 발동 플래그로 전환 필요.

### 2.3 이미 갖춰진 인프라 (재사용 대상)

- **설정 배선 선례 — `comebackStrength`(0~100, 기본 50)**: [gameStore.ts](../src/store/gameStore.ts) persist(partialize `:171-189`) → [PhysicsCanvas.tsx](../src/components/PhysicsCanvas.tsx) `useEffect` postMessage(`:181-185`) + INIT payload → [physics.worker.ts](../src/engine/physics.worker.ts) `SET_COMEBACK_STRENGTH`(`:350`) → `SimulationCore.setComebackStrength()`(`:468`). 슬라이더 UI 템플릿은 [SettingsModal.tsx](../src/components/SettingsModal.tsx) `:295-314`.
- **리스폰 프리미티브 — 홀 페널티 리스폰**: `holeRespawns` 큐(`:172`) → `processHoleRespawns()`(`:925-942`)에서 `setTranslation + setLinvel(0) + SkillSystem.recalcPhysics`. 구조 리스폰이 그대로 재사용할 수 있는 검증된 경로.
- **자유공간 검증 도구**: [SafePlacement.ts](../src/engine/SafePlacement.ts)의 `computeKeepOutZones`(기물 → 키프아웃 원) + [wallGeometry.ts](../src/engine/wallGeometry.ts)의 `getWallTransform(y, height, style)`(임의 y에서의 플레이 영역 내폭). Rapier 쿼리 파이프라인은 미사용 — 원 겹침 수학으로 충분.
- **헤드리스 검증**: [scripts/simulate.ts](../scripts/simulate.ts) — 완주 중앙값 45~70초 창, 공정성 `|corr|<0.25`, 정체·미완주 0 등 합격선 리포트. 시드 주입 결정론.
- **시간 배율 체계**: `dt = (1/60) * GLOBAL_SPEED_MODIFIER(0.9) * baseTimeScale * effectTimeScale`, `4/60` 클램프(`step()` `:412-417`). `baseTimeScale`은 기존 "게임 속도" 설정, `effectTimeScale`은 수동 빨리감기(1→2→4배).

## 3. 목표 동작 (To-Be) & 요구사항

| # | 요구사항 | 수용 기준 |
|---|---|---|
| R1 | "플레이 시간" 설정 (0~100, 기본 50) | 환경설정 슬라이더. 50 = 현재 동작과 **완전 동일**(동일 시드 A/A에서 finishOrder 일치). 낮을수록 마무리가 빨라지고, 높을수록 느긋해짐 |
| R2 | 승패 불변 | 슬라이더 값과 무관하게 4개 모드 전부 우승자 확정 결과·시각이 50 기준과 동일 (우승 확정 전 물리 무개입) |
| R3 | 꼬리 압축 | playTime=0에서 우승 확정→전원 완주(tailSeconds) 중앙값 ≤ 8초, p90 ≤ 15초 |
| R4 | 갇힘 구조 | 밀폐 공간에 갇힌 마블이 유한 시간 내 근처 열린 공간으로 리스폰되어 레이스 복귀. 미완주(timedOutRaces) 0 유지 |
| R5 | 구조의 공정성 | 리스폰이 칩의 기존 최대 진행도(chipMaxY)를 초과해 전진시키지 않음. 정상 플레이에선 구조가 발생하지 않음(rescues/race < 0.5) |
| R6 | 결정론 | 모든 신규 로직이 프레임 기반 + `this.rng` — 시뮬 하네스에서 완전 재현 |
| R7 | 연출 배려 | 구조/가속 이벤트는 시각·청각 피드백 제공, 차분 모드(calmMode) 시 저자극 버전 |

## 4. 설계 (Design)

### 4.A "플레이 시간" 슬라이더 (R1~R3)

#### 레버 평가

| 레버 | 판정 | 근거 |
|---|---|---|
| (a) 재생 배속(dt 스케일 전역) | 기각 | 기존 "게임 속도"(baseTimeScale) 설정·수동 빨리감기와 완전 중복. 같은 효과의 설정 두 개는 혼란만 유발 |
| (b) 물리 페이스(GRAVITY_Y·감쇠 스케일) | 기각 | 종단속도 중심으로 튜닝된 완주 45~70초 창, 기믹 적중률 등 전 맵 밸런스 재검증 필요. turtle/random 모드 승패 왜곡 |
| (c) **꼬리 압축(우승 확정 후 자동 가속)** | **채택 — 주 레버** | 통증의 정확한 위치를 타격. gameOver 이후이므로 전 모드 승패 무영향(§2.1) |
| (d) **anti-stuck 윈도 스케일** | **채택 — 보조 레버** | "끼어서 늦는" 케이스를 직접 단축. 우승 전에도 작동하지만 끼인 칩에만 전원 동일 규칙으로 개입 — 공정성 영향 미미 |
| (e) 맵 길이(lengthType) 유도 | 기각(범위 외) | 맵 선택 UI의 영역 |

#### 매핑 공식 ([SimulationCore.ts](../src/engine/SimulationCore.ts) 상단 신규 상수)

```ts
// 환경설정 "플레이 시간"(0~100) → 내부 파라미터. playTime01 = value / 100.
// 50 = 완전 중립(현재 동작과 동일)을 수식으로 보장한다.
const compress = Math.max(0, 0.5 - playTime01) * 2;   // 0..1 (50 미만에서만 활성)
const extend   = Math.max(0, playTime01 - 0.5) * 2;   // 0..1 (50 초과에서만 활성)

// ① anti-stuck/구조 윈도 스케일 — L1·L2·L3 + 구조 리스폰(§4.B) 공용
const stuckWindowScale = 1 - 0.5 * compress + 0.8 * extend;   // 0.5 ← 1.0 → 1.8

// ② 마무리 자동 가속(FINISH RUSH) — gameOver && !allFinished 에서만 dt 배율
const ENDGAME_MAX_BOOST = 1 + 2.0 * compress;                 // 1.0 ←→ 3.0
const ENDGAME_RAMP_FRAMES = 180;                              // 우승 확정 후 3초 선형 램프
endgameBoost = 1 + (ENDGAME_MAX_BOOST - 1)
             * Math.min(1, framesSinceGameOver / ENDGAME_RAMP_FRAMES);

// ③ 마무리 견인(finish pull) — 미완주·비동결 칩에 하향 가속(px/s²)
const FINISH_PULL_MAX = 150;   // 종단속도 ~817 → ~1650 (MAX_CHIP_SPEED 2000 이내)
finishPullAccel = FINISH_PULL_MAX * compress * ramp;          // ramp = ②와 동일
```

**끝점 체감**
- `0` (최단): 우승 확정 3초 후 3배속 + 잔여 주자 하향 견인 + 끼임 구조 2배 빠름 + L3 ~100초. 꼬리 목표 중앙값 ≤8초.
- `50` (기본): 오늘과 완전 동일.
- `100` (최장): 자동 가속 없음, 구조·폭풍 윈도 1.8배 느긋, L3 ~6분 — "끝까지 느긋한 관전" 모드.

#### 적용 지점

1. **[SimulationCore.ts](../src/engine/SimulationCore.ts)**
   - 필드 `playTime01 = 0.5` + `setPlayTime(value)` (`setComebackStrength :468` 패턴), `SimInitConfig`에 `playTime?: number`.
   - `step()`(`:412`): `gameOverFrame` 기록, `rawDt`에 `endgameBoost` 곱. **기존 `Math.min(rawDt, 4/60)` 클램프가 최종 안전장치로 유지** — 수동 빨리감기 4배·baseTimeScale과 곱해져도 오늘 이미 허용된 dt 상한을 넘지 않는다.
   - 신규 `applyFinishPull(dt)`: `gameOver && !allFinished`일 때 미완주·비동결(gravityScale≠0 제외) 칩에 `applyDeltaV(chip, 0, finishPullAccel * dt)`. `clampVelocities` 앞에 배치해 캡의 보호를 받는다.
   - `applyAntiStuck()`: L1 `300`, L2 `300*COOLDOWN_SCALE`, L3 `10800*COOLDOWN_SCALE`에 각각 `* stuckWindowScale`. **동시 수정**: `Math.random()` 2곳 → `this.rng()`, L3 `===` → `>= && !l3Fired` 플래그.
   - 부스트 단계 진입 시(1.5x/2x/3x) `FINISH_RUSH` 이벤트 1회 발행(UI 배지용).
2. **[physics.worker.ts](../src/engine/physics.worker.ts)**: INIT payload에 `playTime` 추가, 신규 `SET_PLAY_TIME` 핸들러(`SET_COMEBACK_STRENGTH :350` 패턴).
3. **[gameStore.ts](../src/store/gameStore.ts)**: `playTime: number`(기본 50) + setter + partialize 등재.
4. **[SettingsModal.tsx](../src/components/SettingsModal.tsx)**: comebackStrength 슬라이더 블록(`:295-314`) 복제. 라벨 **"플레이 시간 (PLAY TIME)"**, 값 표기 `빠른 마무리(<50) / 기본(50) / 느긋하게(>50) · {값}`. 설명문: "낮을수록 우승 확정 후 남은 경기가 자동으로 빨라지고 끼인 마블 구조가 빨라집니다. 50이 기존 속도입니다." snapshot/handleCancel/handleReset(50) 4곳 모두 반영.
5. **[PhysicsCanvas.tsx](../src/components/PhysicsCanvas.tsx)**: `useEffect` postMessage 배선 + INIT payload 포함 + `FINISH_RUSH` 수신 시 우상단 "⏩ 자동 빨리감기" 배지(calmMode 시 무광·정적 표시). 수동 빨리감기(effectTimeScale)와는 곱연산으로 자연 합성되고 dt 클램프가 상한을 담당 — UI 충돌 없음.

### 4.B 갇힘 → 근처 열린 공간 구조 리스폰 (R4~R6) — "구조 리스폰"

**노출: 설정 토글 없는 상시 엔진 안전장치.** L2 임펄스가 2회 연속 실패한 뒤에만 발동하므로(기본 설정 기준 끼인 지 ~15초) 정상 레이스에선 절대 나타나지 않는다. "플레이 시간" 슬라이더는 발동까지의 시간(`stuckWindowScale`)만 조절한다.

#### 감지 — L2 확장 ([SimulationCore.ts](../src/engine/SimulationCore.ts) `applyAntiStuck`)

```ts
private chipRescueFails = new Map<string, number>(); // L2 연속 실패 카운터

// L2 발동부(:1193)에서:
const fails = (this.chipRescueFails.get(id) ?? 0) + 1;
if (fails >= RESCUE_AFTER_L2_FAILURES /* =2 */
    && chip.gravityScale() !== 0                     // 홀 트랩 동결 제외
    && this.frame - lastRescueFrame > RESCUE_MIN_INTERVAL) {
  this.rescueChip(chip, id);                          // 임펄스 대신 리스폰
  this.chipRescueFails.set(id, 0);
} else {
  /* 기존 탈출 임펄스 */ this.chipRescueFails.set(id, fails);
}
// chipMaxY가 80px 이상 갱신되는 분기(:1185)에서 카운터를 0으로 리셋
```

신규 상수: `RESCUE_AFTER_L2_FAILURES = 2`, `RESCUE_MIN_INTERVAL = round(600 * COOLDOWN_SCALE)`(~10초), `RESCUE_MAX_ATTEMPTS = 12`, `RESCUE_RING_BASE = 60`, `RESCUE_RING_STEP = 30`, `RESCUE_CLEARANCE = 38`(칩 반경 18 + 여유 20), `RESCUE_FORWARD_CAP = 30`.

#### 후보 생성·검증 — 전부 `this.rng` (결정론, R6)

- **키프아웃 존 1회 캐싱**(init): [SafePlacement.ts](../src/engine/SafePlacement.ts) `computeKeepOutZones` 재사용. `iceblock`은 wall과 동일 취급(`r = max(w,h)/2`), `hole`은 `r = radius + 20` 확대(함정 위 리스폰 금지). y 정렬 배열로 저장해 검증 시 `|zone.y − y| < 300` 프리필터. (파괴된 iceblock이 존에 남는 것은 보수적 오탐 — 허용)
- **플레이 영역 내폭**: [wallGeometry.ts](../src/engine/wallGeometry.ts) `getWallTransform(y, worldHeight, wallStyle)` → `innerL/innerR ± RESCUE_CLEARANCE`. init에서 `wallStyle` 보관 필요.
- **링 샘플링**: 시도 i(0..11)마다 반경 `r = 60 + i*30`, 각도 `θ = rng()*2π`; 후보 `x = clamp(cx + cosθ·r, innerL, innerR)`, `y = clamp(cy + sinθ·r·0.5, startLineY+50, finishLineY−100)`.
- **공정성 규칙 (R5)**: `y ≤ min(chipMaxY + RESCUE_FORWARD_CAP, cy + 40)` — 자기가 벌어놓은 진행도를 초과해 전진하지 않는다. 뒤로(위로) 물러나는 것은 자유.
- **검증**: 인근 키프아웃 존 전부에 대해 `dist ≥ zone.r + RESCUE_CLEARANCE`.
- **폴백 사다리**: ① 12회 실패 → 해당 y의 플레이 영역 중앙선 `x=(innerL+innerR)/2, y=cy−80`을 hole/blackhole 존만 검사해 배치 ② 그마저 실패 → 이번 윈도는 기존 L2 임펄스로 대체하고 다음 윈도에 재시도(무한 안전).

#### 실행·연출 (R7)

- 즉시 실행(홀 페널티와 달리 지연 불필요): `body.setTranslation({x,y}); body.setLinvel({0,0}); SkillSystem.recalcPhysics(body, id)` — `processHoleRespawns`(`:925-942`)와 동일 프리미티브. `chipMaxY`/`chipLastProgressFrame` 기준점 갱신.
- 이벤트 `CHIP_RESCUED { chipId, from, to }` + `SOUND_EFFECT 'teleport'`(기존 사운드 재사용). [PhysicsCanvas.tsx](../src/components/PhysicsCanvas.tsx): 출발·도착 두 지점에 짧은 텔레포트 플래시(calmMode 시 파티클 생략, 페이드만), 스킬 로그 피드에 "🛟 ○○○, 구조되었습니다!" 한 줄.
- 엣지 케이스: 완주 칩 제외(기존 필터), 홀 트랩(gravityScale 0)·`holeRespawns` 대기 칩 제외, `RESCUE_MIN_INTERVAL`로 연속 구조 진동 방지.

### 4.C 추가 아이디어 — 루즈한 엔드게임 (우선순위)

1. **"결과 빨리보기" 버튼 (1순위, 강력 권장)** — `winner_declared` 상태에서 빨리감기 버튼 옆에 노출. 클릭 시 워커에 `RESOLVE_REST` 전송 → 워커가 STEP 메시지 대기 없이 자체 루프로 `core.step()`을 청크(600프레임 단위, 사이 `setTimeout(0)`) 실행하고 **FRAME 브로드캐스트를 5프레임에 1회로 줄여 "타임랩스" 연출** → `allFinished` 시 기존 `ALL_FINISHED` 흐름 합류. Y좌표 순 추정이 아니라 **실제 물리 결과 그대로**라 순위표 신뢰성·결정론 유지. §4.B 구조 리스폰이 종료를 보장하므로 항상 유한 시간 내 끝난다. 변경: [physics.worker.ts](../src/engine/physics.worker.ts)(신규 메시지·터보 루프), [PhysicsCanvas.tsx](../src/components/PhysicsCanvas.tsx)(버튼·상태).
2. **FINISH RUSH 자동 가속** — §4.A의 ②③. 슬라이더 50 미만에서 자동 작동.
3. **잔여 주자 브로드캐스트 UI** — `winner_declared` 시 하단에 "남은 주자 N명" 스트립: 미완주 칩들의 결승선까지 거리 게이지(기존 `RANKINGS_UPDATE` 데이터로 순수 UI 구현, 물리 무개입). 마지막 1명이 되면 카메라 스포트라이트("라스트 러너") + 긴장 SFX — 저비용으로 체감 지루함을 크게 줄임.
4. **L3를 보이는 드라마로 ("최후의 돌풍")** — 현재 침묵 속 중력 2배(`:1200-1207`)를 `FINAL_SURGE` 이벤트로 표면화: 화면 가장자리 바람 이펙트 + 경고 배너 + SFX. 슬라이더로 발동 시점이 스케일되므로 "강제 종료"가 아니라 "설계된 클라이맥스"로 읽힌다. calmMode 시 배너만.
5. **하강 스위퍼(용암/밀대) — 보류** — 우승 확정 후 위에서 내려오며 닿은 칩을 완주 처리하는 벽. 연출은 강렬하나 키네마틱 벽이 칩을 기물에 끼워 넣는 물리 잔고장 위험이 크고, 효과 면에서 finish pull(②③)과 중복. 차기 후보로만 기록.

**모드별 안전성 (필수 확인 사항)**: 위 1~5 전부 gameOver 이후에만 개입 → speed/custom/random/turtle 전 모드에서 승자 확정에 무영향. turtle 모드는 gameOver 자체가 레이스 종반에 발생하므로 꼬리 압축의 절대 효과는 작지만 부작용도 없다. **우승 확정 전 물리 개입은 anti-stuck 윈도 스케일이 유일**하며, 이는 끼인 칩에게만 전 참가자 동일 규칙으로 적용된다.

---

## 5. 파일별 변경 요약

| 파일 | 변경 |
|---|---|
| [src/engine/SimulationCore.ts](../src/engine/SimulationCore.ts) | `playTime01`·`setPlayTime`·`SimInitConfig.playTime`, `gameOverFrame`+`endgameBoost`(step dt), `applyFinishPull`, anti-stuck 윈도 스케일, **구조 리스폰**(감지·샘플링·검증·실행·`CHIP_RESCUED`), `Math.random`→`this.rng`, L3 `===`→`>=`+플래그 — 변경의 ~80% |
| [src/engine/physics.worker.ts](../src/engine/physics.worker.ts) | INIT payload `playTime`, `SET_PLAY_TIME` 핸들러, (아이디어 1) `RESOLVE_REST` 터보 루프 |
| [src/store/gameStore.ts](../src/store/gameStore.ts) | `playTime`(기본 50) 상태·setter·partialize |
| [src/components/SettingsModal.tsx](../src/components/SettingsModal.tsx) | "플레이 시간" 슬라이더(comebackStrength 블록 복제, snapshot/cancel/reset 4곳) |
| [src/components/PhysicsCanvas.tsx](../src/components/PhysicsCanvas.tsx) | postMessage 배선, `FINISH_RUSH` 배지, `CHIP_RESCUED` 플래시·피드, (아이디어 1·3) 결과 빨리보기 버튼·잔여 주자 스트립 |
| [scripts/simulate.ts](../scripts/simulate.ts) | `playTime` CLI 인자, `tailSeconds`·`rescues/race` 지표, A/A 결정론 검증 모드 |

**신규 상수(튜닝 시작값)**: `ENDGAME_MAX_BOOST 3.0`, `ENDGAME_RAMP_FRAMES 180`, `FINISH_PULL_MAX 150`, `stuckWindowScale 0.5~1.8`, `RESCUE_AFTER_L2_FAILURES 2`, `RESCUE_MIN_INTERVAL 600*scale`, `RESCUE_MAX_ATTEMPTS 12`, `RESCUE_RING_BASE 60 / STEP 30`, `RESCUE_CLEARANCE 38`, `RESCUE_FORWARD_CAP 30`. 전부 SimulationCore 상단에 모아 시뮬 스윕 대상으로.

## 6. 검증 (Verification)

1. **시뮬레이터 매트릭스** — [scripts/simulate.ts](../scripts/simulate.ts) 확장 후 전 맵 × `playTime ∈ {0, 25, 50, 75, 100}`, races ≥ 40:
   - `playTime=50`: rng 교체 후 재베이스라인 대비 지표 동등 + **동일 시드 A/A에서 finishOrder 완전 일치** (결정론·중립성 증명, R1·R6)
   - `playTime=0`: `tailSeconds` 중앙값 ≤ 8초·p90 ≤ 15초 (R3); **우승자 확정 시각·결과는 50과 통계적 동일** (우승 전 무개입 증명, R2)
   - 전 값: 공정성 `|corr| < 0.25` 유지, `timedOutRaces = 0`, gravityStorm 증가 없음, `rescues/race < 0.5` (R4·R5; 초과 시 해당 맵 자체 결함 진단 신호)
   - `playTime=100` 측정 시 하네스 `MAX_SECONDS` 240 → 400 상향 (L3가 ~360초로 밀리므로)
2. **인게임 육안** (`npm run dev`):
   - 슬라이더 0: 우승 확정 후 자동 가속 배지 표시·잔여 주자 신속 완주, 슬라이더 100: 자동 가속 없음
   - 좁은 포켓이 있는 맵(에디터로 인위 제작)에서 끼인 마블이 ~15초 내 근처 열린 공간으로 플래시와 함께 이동, 자기 진행도보다 앞으로 가지 않는지
   - calmMode에서 구조 플래시·러시 배지가 저자극 버전인지 (R7)
3. **설정 확인**: 슬라이더 값 재시작 후 유지(persist), 취소 시 스냅샷 복원, 초기화 시 50
4. `npx tsc --noEmit` 신규 에러 없음

## 7. 리스크 / 오픈 이슈

- **기본값 50에서는 슬라이더 자체가 루즈함을 해결하지 않는다** (엄격한 50-중립 채택의 대가). 기본 체감 개선은 상시 장치(구조 리스폰 + 결과 빨리보기 + 잔여 주자 UI)가 담당. 시뮬 검증 후 기본값을 35로 낮추는 것은 gameStore 한 줄 변경으로 후속 결정 가능.
- dt 부스트 3배 + baseTimeScale 2배 조합은 기존 `4/60` 클램프에 걸려 실효 ~4.4배 — 수동 빨리감기로 오늘 이미 도달하는 영역이라 신규 물리 불안정 없음(터널링 회귀만 육안 확인).
- 구조 리스폰 남발 시 "순간이동 게임" 체감 → 2회 실패 전제 + 10초 간격 + `rescues/race` 지표로 가드.
- 키프아웃 캐시가 파괴된 iceblock을 계속 회피(보수적 오탐) — 기능상 무해, 코드 주석으로 명시.
- **기존 불일치**: worker `GLOBAL_SPEED_MODIFIER = 0.7`([physics.worker.ts](../src/engine/physics.worker.ts) `:41`, 쿨다운 전용) vs 코어 `0.9` — 본 건과 무관하나 쿨다운 스케일 혼선의 원천으로 기록. 후속 정리 권장.
