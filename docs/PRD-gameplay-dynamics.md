# PRD — 플레이 역학 개선: 역전 다이내믹스 + 수직 낙하감 복원

> 상태: **v1.1 구현 완료** · 작성 2026-07-04 · 대상: 칩(마블) 이동 물리 · 순위 역학
> 관련 문서: [PRD_Architecture.md](../PRD_Architecture.md), [docs/OBSTACLES.md](./OBSTACLES.md)

## 0. 구현 노트 (v1.1 — 시뮬레이터 A/B 검증으로 확정된 2가지 수정)

설계대로 구현하되, `scripts/simulate.ts` 10판×10맵 A/B 비교에서 발견된 회귀·기존 버그를 다음과 같이 수정:

1. **수평 감쇠는 "빠른 하강 중"에만 적용 (fall-gating).** A1을 무조건 적용하면 저속·굴림·끼임 탈출에 필요한 측면 이동까지 죽여 정체(gravityStorm)가 급증(플링코 0→36회 등). `fallFactor = clamp(vy/400, 0, 1)`을 감쇠 강도에 곱해 **낙하 중에만 수직화**하고 저속 상황의 측면 자유를 보존 → 정체 지표가 베이스라인 수준으로 회복. 사용자 불만("내려오다가 옆으로 흘러감")은 정확히 고속 하강 구간의 현상이므로 목적과도 정합.
2. **기존 버그 수정 — 폭풍 트리거 분모 오류.** `totalSpeed`는 미완주 칩만 합산하는데 평균은 전체 칩 수로 나누고 있어(`totalSpeed / activeChips.length`), 완주자가 늘수록 평균이 과소평가 → 종반 폭풍 과발동. 미완주 칩 수로 나누도록 수정하고, 폭풍 킥도 완주 칩을 제외.

**A/B 결과(10판×12칩, 10개 프리셋)**: 완주 시간 유지~단축, 선두 교체 7/10 맵에서 증가(예: 룰렛 15.9→18.2회), 공정성 개선(포탈미궁 corr 0.28→0.12, 토네이도 0.24→0.10 — 팩 압축이 스폰 우위를 상쇄), 정체·미완주는 베이스라인 동등 범위.

---

## 1. 배경 (Context)

사용자 보고 2건:

1. **선두 고착(leader lock-in)**: 1등이 한 번 정해지면 끝까지 1등하는 경향. 꼴등의 추격, 1·2등 엎치락뒤치락, 후반부 역전 같은 드라마가 부족하다.
2. **해파리 표류(jellyfish drift)**: 칩이 수직으로 낙하하다가 갑자기 옆으로 미끄러지거나 이상한 곳으로 흘러간다. 좌우 움직임은 유지하되 **수직 낙하 중심**의 움직임이 필요하다. 단, 기물(범퍼·바람·플리퍼 등)에 의한 측면 영향은 그대로 받아야 한다.

## 2. 현재 구조 분석 (As-Is) — 탐색으로 확정한 사실

### 2.1 선두 고착의 구조적 원인: 시뮬레이션이 순위를 전혀 모른다

- **러버밴딩/캐치업/핸디캡 로직이 코드 어디에도 없음.** `RankingTracker`([src/engine/RankingTracker.ts](../src/engine/RankingTracker.ts))는 10프레임마다 Y 정렬로 순위를 계산하지만, 결과는 **UI 리더보드·카메라 전용**으로만 흐르고 물리로 피드백되지 않는다.
- **모든 칩이 물리적으로 동일**([src/engine/ChipFactory.ts](../src/engine/ChipFactory.ts): 반지름 18, 감쇠 0.18, 반발 0.6, 밀도 1.2). 개인차·운 스탯 없음.
- **스킬 6종(tank/booster/ghost/slime/magnet/teleport)은 완전 랜덤**: 칩마다 독립 쿨다운(약 5~15초 균등분포)이 차면 6종 중 **균등 확률**로 발동([physics.worker.ts](../src/engine/physics.worker.ts) `processSkillCooldowns`). 순위를 전혀 보지 않으므로 선두가 booster를 뽑으면 격차가 더 벌어진다.
- **기물(부스터·포탈·홀·럭키게이트·중력장)도 전부 공간 트리거** — 지나가는 자에게 무차별 적용. 선두는 정의상 가장 앞선 코스를 달리므로, 가속 기물은 통계적으로 선두를 더 밀어준다.
- 유일한 "뒤처진 자 보정"은 안티스턱 레벨 2(7초간 정체 시 킥)인데, 이는 **물리적 끼임 해소용**이지 순위 보정이 아니다.
- 결론: 한 번 앞선 칩을 되돌리는 힘이 구조적으로 0. 홀 함정·럭키게이트 스턴 같은 RNG 후퇴만이 역전 요인이며 빈도가 낮다.

### 2.2 해파리 표류의 원인: 자율적 측면 힘 2개 + 수평 감쇠 부재

| # | 원인 | 위치 | 크기 |
|---|---|---|---|
| P1 | **안티스턱 레벨 2** — 정체 칩을 맵 중앙(x=400 하드코딩)으로 미는 수평 킥 | [SimulationCore.ts](../src/engine/SimulationCore.ts) `applyAntiStuck` (`towardCenter = (400-x)*1.5`) | 가장자리 칩 기준 **최대 ±450px/s 수평** + 랜덤 ±75 |
| P2 | **안티스턱 레벨 1(중력 폭풍)** — 전체 정체 시 모든 칩에 랜덤 산포 | 동일 함수 | **±350px/s 수평** + 상향 |
| P3 | **수평 전용 감쇠/캡 부재** — `linearDamping 0.18`은 축 구분이 없고 매우 낮음. `MAX_CHIP_SPEED 2000` 클램프도 방향 무관 크기 캡뿐 | ChipFactory / `clampVelocities` | 측면 킥 1회가 수 초간 글라이딩 |

즉 "갑자기 옆으로 가는" 순간은 P1/P2가 만들고, "해파리처럼 오래 흘러가는" 질감은 P3(수평 속도가 좀처럼 죽지 않음)이 만든다. 기물 힘(바람·부스터·중력장·플리퍼·피스톤·아이스 바운스)은 전부 의도된 것으로 **보존 대상**.

### 2.3 이미 갖춰진 튜닝 인프라

- `scripts/simulate.ts` 헤드리스 시뮬레이터가 **선두 교체 횟수를 이미 측정**("박진감 선두교체 평균 N회", 합격선 ≥3), 완주 시간 중앙값(45~70s), 공정성(`|corr(spawnX, rank)| < 0.25`), 가장자리 주행률 등을 리포트.
- 설정 배선 선례: `gimmickDensity` 슬라이더가 gameStore → INIT payload → SimulationCore로 흐르는 경로 완비.
- 순위 훅: `RankingTracker.updateRankings`가 이미 `step()` 내부에서 호출됨 — 캐치업 힘을 꽂을 자리가 마련되어 있음.

---

## 3. 목표 동작 (To-Be) & 요구사항

| # | 요구사항 | 수용 기준 |
|---|---|---|
| R1 | 순위 유동성 | 시뮬레이터 기준 선두 교체 평균 **≥3회/판** 유지·향상, 순위 총 변동량(churn) 신규 측정치 상승 |
| R2 | 후반 드라마 | 레이스 후반(진행도 0.5+)에도 역전이 발생, 최하위권의 상위권 진입 사례 발생 |
| R3 | 조작감 없는 공정성 | 캐치업은 연속적·미세 보정(순간이동·급가속 없음), `|corr(spawnX, rank)| < 0.25` 유지, 완주 시간 45~70s 유지 |
| R4 | 수직 낙하감 | 칩이 자율적으로 옆으로 흘러가지 않음. 평균 \|vx\|/\|vy\| 비율(신규 측정) 감소 |
| R5 | 기물 영향 보존 | 바람·부스터·중력장·플리퍼 등 기물에 의한 측면 이동은 체감 변화 없이 동작 |
| R6 | 설정 가능 | "역전 강도" 설정(0=끄기)으로 사용자가 강도 조절 가능 |

---

## 4. 설계 (Design)

### 4.A 수직 낙하감 복원 (R4, R5) — 문제 2

**A1. 수평 전용 지수 감쇠 (핵심).** `clampVelocities`([SimulationCore.ts](../src/engine/SimulationCore.ts))에 축 분리 감쇠 추가:

```ts
// 수평 속도만 공기저항처럼 자연 감쇠. 수직(낙하)은 불변.
const H_DAMP = 0.9; // 초당 감쇠 강도 (튜닝 0.6~1.5)
vx *= Math.exp(-H_DAMP * dt);
```

- 기물이 주는 측면 킥은 그대로 들어오되(임펄스 보존), 이후 **자연스럽게 잦아들며 수직 낙하로 복귀** — "해파리 글라이딩" 질감 제거.
- 지속형 기물과의 공존 검증: 바람 대포는 ~300px/s²의 연속 가속이므로 H_DAMP=0.9에서 평형 측면 속도 ≈330px/s — 바람 효과 체감 유지(R5). 중력장·플리퍼도 동일 원리로 보존.
- `linearDamping 0.18`(종단 낙하속도 결정)은 **변경하지 않는다.**

**A2. 수평 소프트 캡(안전장치).** `|vx| > 900` 초과분만 강하게 감쇠(하드 클램프 아님) — 극단적 측면 발사 방지. `MAX_CHIP_SPEED 2000` 크기 캡은 유지.

**A3. 안티스턱 레벨 2 킥 재설계.** 수평 주도 → **수직 주도**로:

```ts
// 기존: towardCenter = (400 - x) * 1.5 (최대 ±450 수평) + 450 하향
// 변경: 수평은 중앙 방향 최대 ±150로 캡, 하향 500 주도. 중앙 기준은 worldWidth/2 (하드코딩 제거)
const towardCenter = clamp((this.worldWidth / 2 - t.x) * 0.5, -150, 150);
this.applyDeltaV(chip, towardCenter + (Math.random() - 0.5) * 80, 500);
```

끼임 해소 능력은 하향 강화로 보존하되 "갑자기 옆으로 순간 가속"을 제거.

**A4. 중력 폭풍(레벨 1) 수평 성분 축소.** `(rand-0.5)*700` → `(rand-0.5)*300`. 전체 산포 이벤트의 목적(정체 해소)은 유지하며 측면 산포만 완화.

### 4.B 역전 다이내믹스 (R1~R3, R6) — 문제 1

3계층 구조. 모두 신규 설정 `comebackStrength`(0~100, 기본 50)로 일괄 스케일되며 0이면 완전 비활성.

**B1. 팩 압축(연속 캐치업) — 주력.** `step()`에서 `updateRankings` 직후, 레이싱 중(미완주) 칩에 격차 비례 하향 어시스트:

```ts
// 선두와의 Y 격차에 비례한 미세 하향 가속 (연속·mass-normalized)
const gap = leaderY - chipY;                       // 0(선두) ~ 수천 px
const t = Math.min(gap / GAP_REF, 1);              // GAP_REF = 1200px
const assist = t * CATCHUP_ACCEL * strength01;      // CATCHUP_ACCEL = 90 px/s² (최대)
this.applyDeltaV(chip, 0, assist * dt);
```

- 순수 하향(수평 0) → 4.A의 수직 낙하감과 정합.
- 최대 90px/s²는 중력(147px/s²)의 ~60% 수준의 보이지 않는 미풍 — 순간 역전이 아니라 **팩이 서서히 조여져** 접전 구간이 잦아지는 방식(R3).
- 스턴/홀 트랩(gravityScale 0) 상태는 제외, `finishedChips` 제외, `MAX_CHIP_SPEED` 클램프가 뒤에서 안전망.

**B2. 선두 미세 역풍.** 1위가 2위와 `LEAD_GAP_PX(400)` 이상 벌렸을 때만, 1위의 하향 속도에 미세 드래그(`vy *= 1 - 0.06 * strength01 * dt` 상당). 독주를 완화해 1·2위 접전(엎치락뒤치락)을 유도. 격차가 좁혀지면 즉시 해제 — "따라잡을 만하면 다시 놔주는" 고무줄이 아니라 독주 억제만.

**B3. 순위 가중 스킬 추첨.** `processSkillCooldowns`의 균등 랜덤(`Math.floor(Math.random()*6)`)을 순위 3분위 가중 테이블로 교체:

| 스킬 | 상위 1/3 | 중위 | 하위 1/3 | 근거 |
|---|---|---|---|---|
| booster / tank / teleport (전진계) | 0.5× | 1× | **2×** | 하위권 추격 수단 |
| slime (자기 감속) | **2×** | 1× | 0.5× | 선두 자충수 확률↑ |
| ghost / magnet | 1× | 1× | 1× | 중립 (magnet은 시전자 주변을 끌어당김 — 하위권이 쓰면 선두 견제) |

- 스킬은 **화면에 발동이 보이는** 요소이므로, 역전이 "조작"이 아니라 "스킬 덕분"으로 읽힘(R3의 체감 공정성).
- teleport(바로 앞 칩과 자리 교환)는 하위권 가중 시 자연스러운 연쇄 역전 장치가 됨.
- `comebackStrength` 0이면 가중 없이 기존 균등 추첨.

**B4. 후반 증폭.** B1 어시스트에 진행도 램프 곱: `progress ≥ 0.5`부터 1.0→1.5배 선형 증가 — 후반부 역전(R2) 명시 지원.

### 4.C 설정 배선 (R6)

`gimmickDensity` 선례 그대로:
- [gameStore.ts](../src/store/gameStore.ts): `comebackStrength: number`(기본 50) + setter + persist partialize 추가
- [PhysicsCanvas.tsx](../src/components/PhysicsCanvas.tsx): INIT payload에 포함
- [SimulationCore.ts](../src/engine/SimulationCore.ts): `SimInitConfig`에 수용, `step()`에서 사용
- [Dashboard.tsx](../src/components/Dashboard.tsx) 또는 SettingsModal: "역전 다이내믹스" 슬라이더(0~100, 스킬 토글 UI 패턴 재사용)

### 4.D 측정 확장 — [scripts/simulate.ts](../scripts/simulate.ts)

기존 선두 교체 카운터에 더해:
1. **순위 총 변동량(churn)**: `RANKINGS_UPDATE`마다 `Σ|rank_t − rank_{t−1}|` 누적 — 팩 전체의 유동성 지표
2. **역전 지표**: 중간 지점(progress 0.5) 시점 하위 1/3 칩 중 최종 상위 1/3 진입 수
3. **측면 표류율**: 샘플링 시점 평균 `|vx| / max(|vy|, ε)` — R4 회귀 검증용
4. `comebackStrength` 0/25/50/75/100 스윕 실행 모드

---

## 5. 파일별 변경 요약

| 파일 | 변경 |
|---|---|
| `src/engine/SimulationCore.ts` | A1·A2(clampVelocities 축 분리), A3·A4(applyAntiStuck), B1·B2·B4(step 내 캐치업), config 수용 |
| `src/engine/physics.worker.ts` | B3(순위 가중 스킬 추첨 — 워커가 최신 순위 스냅샷 보유 필요: SimulationCore에서 최근 랭킹 노출) |
| `src/store/gameStore.ts` | `comebackStrength` 상태/영속화 |
| `src/components/PhysicsCanvas.tsx` | INIT payload 전달 |
| `src/components/Dashboard.tsx` (또는 SettingsModal) | 역전 강도 슬라이더 UI |
| `scripts/simulate.ts` | churn·역전·표류율 지표 + 강도 스윕 |

**신규 상수(튜닝 시작값)**: `H_DAMP 0.9`, `LAT_SOFT_CAP 900`, `GAP_REF 1200`, `CATCHUP_ACCEL 90`, `LEAD_GAP_PX 400`, 후반 램프 1.5×, 스킬 가중 2×/0.5×. 전부 SimulationCore 상단 상수로 모아 시뮬레이터 스윕 대상으로.

---

## 6. 검증 (Verification)

1. **시뮬레이터 회귀** (`npx tsx scripts/simulate.ts 40 12`):
   - strength 0: 기존 지표와 동등(순수 회귀 없음 — A파트만의 효과 분리 확인)
   - strength 50(기본): 선두 교체 ≥3 유지·상승, churn·역전 지표 상승, 완주 45~70s·공정성 corr<0.25 유지
   - 측면 표류율이 A파트 적용 전보다 감소
2. **인게임 육안** (`npm run dev`):
   - 칩이 기물 없는 구간에서 곧게 낙하하고, 범퍼/바람 맞은 뒤 수직으로 복귀하는지
   - 바람 대포·중력장 구간에서 기물 효과가 여전히 뚜렷한지 (R5)
   - 후반부에 하위권 추격·1/2위 접전이 체감되는지, 부자연스러운 "고무줄 견인"이 안 보이는지
3. **설정 확인**: 슬라이더 0에서 역전 로직 완전 비활성, 재시작 후 값 유지(persist)
4. `npx tsc --noEmit` 신규 에러 없음

## 7. 리스크 / 오픈 이슈

- **H_DAMP와 지속형 기물 균형**: 바람 대포 평형 속도가 맵별 체감을 바꿀 수 있음 → 기물 힘 상수 재보정 여지(시뮬레이터 기물 적중률 지표로 감시)
- **B2 역풍 체감**: 관전자가 알아채면 "조작감" 위험 → 발동 조건(400px 독주)과 강도(6%/s)를 보수적으로 시작, 슬라이더로 완화 가능
- **B3 워커-순위 동기**: 랭킹은 10프레임 주기 갱신이라 추첨 시점 순위가 최대 10프레임 낡을 수 있음 — 스킬 추첨 용도로는 충분
- **커스텀 맵 편차**: worldHeight 2500~4200 편차로 GAP_REF 고정값의 체감이 다를 수 있음 → 필요시 `worldHeight` 비례화
