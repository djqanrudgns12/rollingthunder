# PRD — 맵 검증 고도화: 비동기 워커 검증 + 실시간 스폰 프리뷰 + 인-에디터 테스트 플레이

> 상태: **v1.0 구현 중** · 작성 2026-07-08 · 대상: 맵 에디터 검증 파이프라인 · 테스트 플레이 · 스폰 프리뷰
> 관련 문서: [docs/PRD-gameplay-dynamics.md](./PRD-gameplay-dynamics.md), [docs/PRD-endgame-pacing.md](./PRD-endgame-pacing.md)

## 1. 배경 (Context)

맵 에디터의 "맵 검증" 기능이 구식 구조로 남아 사용성·성능·정합성 문제가 있었다.

- **UX 불명확**: 검증 패널의 "레이스"/"칩" 숫자 입력이 무엇을 의미하는지 알 수 없고("레이스"=시뮬레이션 반복 횟수, "칩"=참가 마블 수), 6개 지표(공정성·엣지허깅 등)에 설명이 없어 결과 해석이 어렵다.
- **동기적 검증**: `mapValidator.runValidation()`이 **메인 스레드**에서 `SimulationCore`를 N회 실행하며 레이스마다 `setTimeout(0)`으로 yield한다. 실제 게임은 이미 Web Worker(`physics.worker.ts`)에서 물리를 돌리는데 검증만 레거시 경로다. 대형 맵·다회 검증 시 편집이 버벅인다.
- **실제 환경 점검 불가**: 에디터에서 실제 레이스를 플레이/관전할 방법이 없다. 기존 `PhysicsPreviewCanvas`는 pin/bumper/wall 3종만 지원하는 간이 프리뷰이며 메인 에디터 플로우(`GameManager → MapEditorManager`)에 연결도 안 되어 있다.

**핵심 이점**: 탐색 결과 에디터 포맷(`EditorItem[]` + `worldHeight`/`wallStyle`/`layoutConfig`)과 게임 엔진(`SimulationCore.init`의 `mapItems`)이 **동일 포맷**이다. 변환 계층 없이 에디터 데이터로 실제 레이스를 구동할 수 있다.

**목표 산출물**: 검증을 워커 기반 비동기로 전환하고, 검증 패널 UX를 개선하며, 에디터에서 실제 게임과 100% 동일한 물리·기믹·렌더로 레이스를 플레이/관전하고, 칩 수 변경 시 스폰 위치를 실시간으로 미리 보여준다.

## 2. 요구사항

| # | 요구 | 대응 |
|---|---|---|
| R1 | 검증 UI 최신화 + UX 개선 | §4 (Phase 2) — 라벨/툴팁/진행률/취소/고급설정 |
| R2 | 칩 배정 시 실시간 동기화 프리뷰 | §5 (Phase 4 정적 스폰 마커) + §6 (Phase 3 라이브 = 테스트 플레이) |
| R3 | 검증 시 실제 레이스 플레이/관전 | §6 (Phase 3) — gameStage 브리지로 PhysicsCanvas 재사용 |
| R4 | 비동기 검증 (레거시 아닌 현 프레임워크/엔진) | §3 (Phase 1) — Web Worker 전환 |

## 3. Phase 1 — 검증 워커 전환 (R4)

`physics.worker.ts` 패턴을 그대로 따라 검증을 워커로 이전한다. 지표 계산 로직은 **원문 그대로** 이동해 마이그레이션 전후 결과 수치가 비트 단위로 동일해야 한다(Rapier는 동일 입력에 결정적, 시드 공식 불변).

**파일 구성**

| 파일 | 역할 |
|---|---|
| `src/lib/editor/validationTypes.ts` | `ValidationResult`/`ValidationConfig`/`HeatmapData`/`CheckRow` 타입 + `VALIDATION_THRESHOLDS` 상수 + `METRIC_INFO`(지표별 라벨/설명 카피) + 워커 메시지 타입. 워커/UI 공유, 사이드이펙트 없음 |
| `src/lib/editor/validationRunner.ts` | `runValidationLoop(config, { onProgress, shouldAbort })` — 기존 `mapValidator.ts` 검증 루프 이동. 환경 불문(워커/메인/Node). `comebackStrength`/`playTime` 옵션을 `core.init`에 전달 |
| `src/lib/editor/validation.worker.ts` | 워커 엔트리(~40줄). 내부에서 `SimulationCore.ensureRapier()`. `RUN`/`CANCEL` 수신 → `PROGRESS`/`RESULT`/`ERROR` 발신 |
| `src/lib/editor/validationClient.ts` | `runValidationAsync(config, { onProgress, signal })` — UI가 쓰는 유일 API. 워커 생성/진행률/취소 캡슐화 |
| ~~`src/lib/editor/mapValidator.ts`~~ | **삭제** (로직→runner, 타입→types) |

**메시지 프로토콜**

```
메인 → 워커:  { type: 'RUN', payload: { config } }  |  { type: 'CANCEL' }
워커 → 메인:  { type: 'PROGRESS', payload: { race, races, pct } }
              { type: 'RESULT', payload: ValidationResult }
              { type: 'ERROR', payload: { message } }
```

**취소 전략(2단계)**: ① `CANCEL` 메시지 → 러너가 다음 레이스 경계에서 중단(소프트). ② `AbortSignal.abort` → 클라이언트가 `worker.terminate()`(하드, 한 레이스가 오래 걸려도 즉시 정지). 워커는 실행당 생성/종료(누수 없음, Rapier WASM 로드 수백 ms는 "검증 실행" 버튼 UX에 허용 범위).

**제약**: 워커 파일은 `SimulationCore`와 순수 유틸만 import(PIXI/React 금지) — `physics.worker.ts`와 동일 제약. 워커 생성은 `new Worker(new URL('./validation.worker.ts', import.meta.url))`(PhysicsCanvas와 동일, Turbopack 검증 패턴).

## 4. Phase 2 — 검증 UI 리디자인 (R1)

`src/components/editor/ValidationPanel.tsx` 전면 수정.

**설정부 라벨 개선**

| 기존 | 개선 | 툴팁 |
|---|---|---|
| `레이스 [8]` | `시뮬레이션 횟수 [8]` | 같은 맵을 몇 번 반복 실행해 통계를 낼지. 많을수록 정확·느림 (권장 8~16) |
| `칩 [10]` | `참가 칩 수 [10]` | 레이스 참가 마블 수. 실제 진행 인원과 맞추세요. 스폰 프리뷰·테스트 플레이와 연동 |
| — | 고급설정(접이식): `역전 다이내믹스`, `플레이 시간 페이싱` 슬라이더 | 최신 엔진 파라미터(0~100, 기본 50) |

칩 수는 `editorStore.previewChipCount` 단일 소스와 양방향 동기화(§5).

**실행/결과부**
- 실행 중: 진행률 바(`레이스 3/8 · 37%`) + **취소 버튼**(AbortController).
- 결과 상단: 종합 배지(`✓ 5/6 통과` / 전부 통과 시 "레이스 준비 완료", 아니면 주황 경고).
- 각 지표 행: ⓘ 아이콘 hover 툴팁(`METRIC_INFO` 공급).
- 히트맵: 기존 렌더 + 색 범례(파랑=통행 적음 → 빨강=밀집/정체) + `미완주 지점 N개` 뱃지.
- 하단: **`▶ 테스트 플레이`** 버튼(§6, 검증 결과 없어도 활성).

**지표 정의 & 임계값** (`VALIDATION_THRESHOLDS`, 계산식은 기존 불변)

| 지표 | 계산 | 합격 | 툴팁 요지 |
|---|---|---|---|
| 완주시간(중앙값) | finishTimes median(초) | 45~70s | 칩 절반의 완주 시간. 시청 몰입 적정창 |
| 공정성 | \|pearson(스폰x, 순위)\| | <0.25 | 출발 가로위치와 순위의 상관. 높으면 특정 자리 유리 |
| 엣지허깅 | 벽 근접(45px) 프레임>50% 칩 비율 | <12% | 벽 붙어 내려간 칩. 높으면 벽쪽이 지름길 |
| 정체(스톰/미완주) | GRAVITY_STORM 수 / 미완주 레이스 수 | 0/0 | 0 아니면 칩 갇힘 지형 존재 — 히트맵 빨간점 확인 |
| 박진감(선두교체) | 레이스당 1위 교체 평균 | ≥3 | 3 미만이면 초반에 승부 확정 단조 맵 |
| 기믹적중 | 기믹별 통과 칩 비율, <15% = 죽은 기믹 | 죽은 0 | 15% 미만 기믹은 위치 조정·제거 |

## 5. Phase 4 — 칩 스폰 실시간 프리뷰 (R2 정적 계층)

칩 수를 바꾸면 에디터 캔버스에 스폰 위치 마커를 즉시 표시(물리 불필요, 60fps 편집 유지).

- `src/engine/spawnSlots.ts` **신설**: `SimulationCore.generateSlots`(private, L420) 본문을 `generateSpawnSlots(count, width, layoutConfig, worldHeight, rng)` 순수 함수로 추출. `SimulationCore`는 위임 호출(동작 불변). 물리·프리뷰가 같은 소스를 써 스폰 좌표 오차 0.
- `editorStore.ts`: `previewChipCount`(기본 10) + setter. 맵 저장 스냅샷에는 미포함.
- `EditorCanvas.tsx`: chrome 레이어에 스폰 마커 오버레이 — `previewChipCount`/`layoutConfig`/`worldHeight` 구독 → 반투명 원형 마커(반지름 18 = ChipFactory 칩 반경) 렌더.

라이브(움직이는) 프리뷰는 별도로 만들지 않는다 — §6 테스트 플레이가 곧 실시간 동기화 프리뷰다.

## 6. Phase 3 — 인-에디터 테스트 플레이 (R3, R2 라이브 계층)

**접근 선택**: gameStage 브리지 (PhysicsCanvas 재사용). `GameManager`가 이미 `gameStage`로 앱을 스위칭하므로 PIXI 앱은 항상 1개(WebGL 컨텍스트 1개). 실제 게임 경로를 그대로 태워 물리·기믹·스킬 VFX·카메라·리더보드가 100% 동일. `editorStore`는 모듈 싱글턴이라 복귀 시 맵 상태 보존.

**전제(버그 수정)**: [MapEditorManager.tsx](../src/components/editor/MapEditorManager.tsx) L24-29 — `hasLoadedInitial`이 컴포넌트 ref라 재마운트 시 리셋. 미저장 신규 맵(mapId=null)으로 테스트 갔다 복귀하면 프리셋으로 덮어씀. `items.length===0` 조건 추가로 방어.

**localStorage 오염 방지**: 테스트 데이터는 `uiStore`의 **비영속 필드** `testPlaySession`으로 전달. `partialize` 화이트리스트에 미포함 → 자동 비영속. 실제 게임 브리지(`customMapData`, persist됨)를 재사용하지 않는다.

- `uiStore.ts`: `testPlaySession: { items, meta{worldHeight,wallStyle,bgImage,layoutConfig}, survivors } | null` + `startTestPlay()`/`endTestPlay()`.
- `src/lib/editor/testPlay.ts` **신설**: `launchTestPlay(chipCount)` — editorStore 스냅샷(items 원본, startline/endline 포함) + 더미 survivors(`T1..Tn`, HSL 휠 색상) 생성 → `startTestPlay` → `setGameStage('playing')`.
- `PhysicsCanvas.tsx` **국소 수정**(alias 전략으로 참조 치환 최소화):
  1. 스토어 바인딩 alias 후 파생: `survivors = testPlaySession?.survivors ?? rosterSurvivors`, `customMapData = testPlaySession?.items ?? uiCustomMapData`, `customMapMeta = testPlaySession?.meta ?? uiCustomMapMeta` — 기존 모든 참조가 자동으로 effective 값 사용, 개별 사용처 무수정.
  2. **ALL_FINISHED 보상 가드**: stampService + supabase 30칩 IIFE(L2003-2021)를 `if (!testPlaySession)`로 감쌈. PROTECTED 상태 전환 로직은 무수정.
  3. **종료 버튼**: `testPlaySession ? (endTestPlay(), setGameStage('editor')) : setGameStage('dashboard')`, 라벨 분기 "에디터로 복귀".
  4. 상단 배지 "🧪 테스트 플레이 — 결과는 기록되지 않습니다".
- `EditorToolbar.tsx` / `ValidationPanel.tsx`: `▶ 테스트` 버튼 → `launchTestPlay(previewChipCount)`.

## 7. Phase 5 — 레거시 정리

- `src/components/editor/PhysicsPreviewCanvas.tsx` **삭제**.
- `/editor` 라우트 `EditorContainer.tsx`의 Test Play 탭 제거(이 라우트는 gameStage 머신 밖 레거시 — 주석 문서화).

## 8. 검증 방법

- **지표 패리티(R4 필수)**: Phase 1 전후 동일 맵·동일 (races, chips) 결과 수치 완전 일치. 시드 결정적이므로 전환 커밋 전 구버전 결과를 캡처해 diff=0 확인.
- **타입/빌드**: `npx tsc --noEmit`(next.config가 빌드 에러 무시 → 별도 필수), dev(Turbopack)·`next build` 양쪽 워커 로드 확인.
- **수동 시나리오**:
  1. 대형 맵(시뮬 16회) 검증 중 취소 → 즉시 복귀, 워커 종료.
  2. 검증 실행 중 에디터 편집 → 프레임 드랍 없음(워커 이관 효과).
  3. 미저장 신규 맵 → 테스트 플레이 → 복귀 → 작업물 보존(전제 버그 수정).
  4. 테스트 플레이 완주 → 칩 보상/스탬프 미지급(네트워크 탭), localStorage `rt-ui-storage`에 테스트 데이터 미저장.
  5. 복귀 후 일반 게임 시작 → `customMapData` 오염 없음.
  6. 칩 수 2/10/20 변경 → 스폰 마커 즉시 갱신, 테스트 플레이 실제 스폰 위치와 육안 일치.

## 9. 리스크

| 리스크 | 대응 |
|---|---|
| MapEditorManager 재마운트 시 프리셋 덮어쓰기(확인된 버그) | Phase 3 첫 작업으로 수정(전제) |
| PhysicsCanvas 거대 useEffect deps 부작용 | alias 파생 후 참조 치환만, PROTECTED 블록 무수정 |
| 워커 취소 지연(레이스 중) | 소프트 CANCEL + 하드 terminate 2단계 |
| Turbopack 워커 번들 | PhysicsCanvas와 동일 패턴, 워커에서 클라이언트 전용 모듈 import 금지 |
| 스킬 시스템 부재(검증) | 스킬 로직은 코어가 아닌 physics.worker에 있어 헤드리스 검증엔 미포함 — 기존 mapValidator도 동일하므로 회귀 아님(향후 P2) |
