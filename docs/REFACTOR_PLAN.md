# 대규모 리팩토링·보수공사 플랜 (2026-07-10)

> **실행 완료 (2026-07-10)** — 전 Phase 적용됨. 변경 내역 하이라이트:
> - `tsc --noEmit` 0건, `next build` 성공, `npm test` 2/2 통과. ESLint 526→370건(잔여는 대부분 캔버스/에디터 내부 `no-explicit-any`, 후속 과제).
> - SQL: `017_gacha_logs_and_inventory_policy.sql` 신설 — **Supabase에 직접 적용 필요**. 실행 전까지 가챠·상점 인벤토리 지급이 완전하지 않음.
> - 가챠 라우트를 인증 세션 + `deduct_chips` RPC + 실제 스키마(user_id/item_type/item_code) 기준으로 교정.
> - `eslint-config-next`는 계획(§3)과 달리 **16.2.9 유지**: 프로젝트의 `eslint.config.mjs`가 v16 전용 flat config 형식이라 15.x는 로드 자체가 불가(검증됨). v16으로도 Next 15 코드 lint는 정상.
> - `reset_db.sql`은 구스키마(chips 컬럼) 스냅샷이라 실행 금지 경고 헤더 추가.
> - 미결: `BlackMarket.tsx` 삭제 여부(상점 영역이라 확인 대기), 스토리지 추천 2(customMapData 탈-localStorage, 설계 승인 필요). 추천 1(설정 서버 동기화)은 **이미 구현되어 있음을 확인**(SettingsModal→updateSettingsAction→profiles.settings).

> 전제: **상점 / 맵에디터 / 커스텀 맵 스토어 / 카메라 기법** 영역은 구조적 리팩토링 금지 —
> 버그 픽스·디버깅·안정화만 수행. 그 외 영역은 정리 진행.

## 0. 현황 진단 요약

| 항목 | 상태 |
|---|---|
| 프레임워크 | Next.js **15.5.19** (package.json `^15.1.4`), React 19.2.4, Tailwind v4, Zustand 5, pixi.js 8.19, @supabase/ssr 0.12 |
| 타입체크 | `tsc --noEmit` **에러 16건** (아래 §1) |
| ESLint | **526건** (353 errors / 173 warnings) — 대부분 `no-explicit-any` |
| 빌드 안전망 | `next.config.mjs`에서 `typescript.ignoreBuildErrors: true`, `eslint.ignoreDuringBuilds: true`로 **오류가 은폐된 채 배포되는 구조** |
| SQL | `gacha_logs` 테이블이 **어느 마이그레이션에도 없음** → 가챠 API 런타임 실패 경로 존재 |
| 참고 | AGENTS.md가 지시한 `node_modules/next/dist/docs/` 문서 디렉토리는 현재 설치본에 존재하지 않음(확인 완료) |

## ※ 인터럽트 이전에 이미 적용된 수정 (8건)

"바로 수정" 지시 하에 적용되었고, 이후 "플랜 먼저" 지시로 중단됨. 원복 원하시면 되돌립니다.

1. `src/app/admin/UserTable.tsx`, `MapTable.tsx`, `EconomyTable.tsx` — Supabase `count`가 `number | null`인데 그대로 `setTotalCount`에 전달하던 것을 `typeof === 'number'` 가드로 수정 (3건)
2. `src/application/useCases/map/GetMapsUseCase.ts` — `themeWeights`/`layoutConfig`를 기본값(`DEFAULT_THEME_WEIGHTS`, `endMarginPercent: 0.02, spawnGap: 50`)과 병합해 타입 정합 확보 (2건)
3. `src/application/useCases/map/SaveMapUseCase.ts` — `finalThemeWeights`를 `Record<string, number>`로 명시 (1건)
4. `src/components/editor/FloatingPanel.tsx` — framer-motion에 **존재하지 않는 `dragHandle` prop** 제거, 정식 API `useDragControls` + `dragListener={false}`로 교체. (기존엔 패널 본문 아무 곳이나 잡아도 드래그되는 실버그였음) (1건)
5. `src/components/editor/HistoryTimelinePanel.tsx` — 존재하지 않는 `width="w-[400px]"` prop → `initialWidth={400}` (1건)

---

## 1. 잔여 타입 에러 수정 (8곳, tsc 0건 목표)

| 파일:라인 | 원인 | 수정안 |
|---|---|---|
| [ToolboxPanel.tsx:19](../src/components/editor/ToolboxPanel.tsx#L19) | `Record<TabType, ItemDef[]>`에 `backgrounds` 키 없음 (배경 탭은 `AVAILABLE_BACKGROUNDS` 별도 배열 사용) | 타입을 `Record<Exclude<TabType, 'backgrounds'>, ItemDef[]>`로 교정 |
| [PhysicsCanvas.tsx:447,514](../src/components/PhysicsCanvas.tsx#L447) | pixi v8 `app.destroy()` 시그니처 변경 — 1번째 인자에 `children`은 무효 옵션이라 **무시됨** | `app.destroy({ removeView: true }, { children: true })` — 리마운트 시 자식/리소스 미해제 누수 실수정 (카메라·인게임 안정화 항목) |
| [GlobalPlayerHUD.tsx:101](../src/components/GlobalPlayerHUD.tsx#L101) | `onAuthStateChange((event))` 암시적 any | `import type { AuthChangeEvent }` 후 명시 |
| [StampBookModal.tsx:73](../src/components/StampBookModal.tsx#L73) | `daily.some(m => …)` 암시적 any | `stampService.getUserMissions` 반환 타입(`UserMission[]`) 명시로 근원 해결 |
| [stampService.ts:170](../src/lib/stampService.ts#L170) | `.sort((a, b))` 암시적 any | `(a: UserMission, b: UserMission)` |
| [DensityCalculator.ts:35-48](../src/engine/DensityCalculator.ts#L35) | `ThemeWeights` 옵셔널 키 인덱싱 → possibly undefined (6건) | `themeWeights[key] ?? 0`, `injectionMix[key] = (… ?? 0)` 패턴 |
| [GimmickInjector.ts:131,157](../src/engine/GimmickInjector.ts#L131) | `injectionMix[type]` possibly undefined | `let count = densityResult.injectionMix[type] ?? 0` |

## 2. 유령 코드 / 레거시 코드 정리

### 즉시 삭제 (근거 확실)
- **`src/data/.!32056!shopData.ts`** — 동기화 도구가 남긴 깨진 임시 파일(shopData.ts의 4.9KB 파편)이 git에 추적되고 있음. `git rm`.
- **`src/engine/RapierWorld.ts`** — 물리를 `physics.worker.ts`/`SimulationCore.ts`로 이관하기 전의 레거시. 프로젝트 어디서도 import되지 않음.

### 삭제 전 확인 요청 (상점 = 제한 영역)
- **`src/components/shop/BlackMarket.tsx`** — 어디서도 import되지 않는 유령 컴포넌트. 향후 기능 예정이면 보존, 아니면 삭제.

### 코드 위생
- `gameStore.ts`의 미사용 import `createJSONStorage` 제거.
- `eslint --fix` 자동 수정 12건 적용 (`prefer-const` 등).
- `no-explicit-any` 353건: 전면 수정은 제한 영역 리스크가 커서 **단계적** 접근 —
  1순위: 공유 계층(`src/types/user.ts`, `src/store/*`, `src/presentation/actions/*`)만 실제 타입 부여.
  나머지(캔버스/에디터 내부)는 후속 과제로 분리. (전부 고치라고 하시면 진행)

## 3. 패키지·의존성 점검 결과

- **런타임 의존성 22개 전부 사용 중** (import 카운트 검증 완료) → 제거 대상 없음.
  pixi-filters(1곳), howler(1곳), @headlessui(1곳) 등 사용처 적은 것도 실사용 확인.
- **`eslint-config-next` 16.2.9 ↔ `next` 15.5.19 메이저 불일치** → `eslint-config-next@^15.5`로 정렬. (Next 16 업그레이드는 별도 과제로 분리 권장)
- **PWA 빌드 산출물이 git에 추적 중**: `public/sw.js`, `public/workbox-f1770938.js`, `public/swe-worker-*.js` — 빌드마다 해시가 바뀌어 잔재가 쌓임. `.gitignore` 추가 + `git rm --cached`.
- `next.config.mjs`의 `ignoreBuildErrors` — §1 완료(tsc 0건) 후 **제거**해 빌드 안전망 복원. `ignoreDuringBuilds`(eslint)는 lint 정리 진도에 맞춰 후속 제거.

## 4. 미사용 이미지 정리 (7개 확정)

전 에셋(이미지·사운드·폰트·아바타)을 파일명 기준 교차 검색 + 동적 경로(`skins/${key}.png`, `obstacles/${n}.png`) 코드 경로까지 검증한 결과:

| 파일 | 미사용 근거 |
|---|---|
| `public/images/assets/obstacles/obstacle_speedgate.png`, `obstacle_slowgate.png` | 에디터·상점 모두 SVG/아이콘(`SVG_ASSETS`, lucide)으로 대체됨. 렌더러는 벡터 드로잉 |
| `public/images/assets/roulette/high_card.png` | `high_card_v2.png`로 교체됨 (LuckyRoulette.tsx:30) |
| `public/images/assets/skins/chip_base_1.png`, `horse.png`, `spaceship.png` | 벡터 스킨(`SKIN_DEFINITIONS` draw 함수)이 항상 우선이며, PNG 폴백은 `PIXI.Assets` 프리로드 목록에 있는 것만 조회됨 — 이 3개는 목록에 없음 |
| `public/images/assets/skins/pr_abyssallord.png` | 프리로드 목록·상점 데이터·스킨 정의 어디에도 없음 |

사운드/폰트/아바타는 전부 사용 중 → 삭제 없음.

## 5. 카메라 기법 안정화 (점검 결과 + 최소 수정)

`cameraDirector.ts` 정독 결과: 프레임레이트 독립 damp/SmoothDamp, 단일 목표 상태머신(TRACKING→APPROACH→CROSS→LINGER→HANDOFF), 히스테리시스·스톨가드 모두 견고. **로직 변경 불필요** — 튜닝 상수 유지.

실제 안정화 수정은 통합부(PhysicsCanvas)에 있음:
1. **pixi v8 `destroy` 무효 옵션** (§1) — 재입장/맵 변경 시 GPU 리소스 누수 가능성 제거.
2. FloatingPanel 드래그 무효 prop — 적용 완료 (§0).
3. 점검 항목(수정은 이상 발견 시에만): `app.ticker.add`된 trailTicker/lineTicker의 정리 경로, `(app as any)._bgResizeHandler` 식 리스너 보관 패턴의 add/remove 짝. 현재 코드상 remove 호출은 존재함 — 빌드 후 재입장 반복으로 확인.

## 6. 맵에디터·상점·커스텀맵스토어·SQL 점검

### SQL (중요)
- **`gacha_logs` 테이블 부재**: `src/app/api/gacha/route.ts`가 `gacha_logs`에 insert 후 `logError`를 throw → 테이블이 없으면 **가챠가 항상 500**. 신규 `supabase/migrations/017_gacha_logs.sql` 작성(테이블 + 본인 조회 RLS) 및 `reset_db.sql` 반영.
- **`006_chip_system.sql` vs `006_chip_system_fixed.sql` 중복·충돌**: 구버전은 `chips` 컬럼, fixed와 코드(`chips_balance`)가 정본. 구버전은 혼선 방지를 위해 삭제 또는 `_archive/`로 이동. (이미 적용된 DB 이력은 영향 없음 — IF NOT EXISTS 기반)
- 커스텀 맵 스토어 RPC(`download_user_map`, `toggle_user_map_like`) ↔ 코드 호출부 일치 확인 완료. user_maps RLS(select/insert/update/delete/admin) 정상 구성.

### 앱 코드
- 에디터/상점 관련 타입 에러 4건은 §1에서 처리 (ToolboxPanel, FloatingPanel, HistoryTimelinePanel, PhysicsCanvas).
- 상점(`shopData.ts` ↔ `user_inventory`), 스토어(`user_maps` 3-tier: 내 맵/스토어/다운로드) 데이터 흐름 점검 — 구조적 문제 없음.

## 7. 데이터 테이블·로컬스토리지 점검 및 마이그레이션 추천

### 현재 localStorage 사용처
| 키 | 내용 | 평가 |
|---|---|---|
| `rt-game-storage` | 게임 설정(테마·폰트·볼륨·차분모드·스킨), 참가자 명단, 선택 맵 | 유지 적절. 단 ↓ 추천 1 |
| `rt-inventory-storage` | **인벤토리 전체 + userId** (partialize 없음) | 계정 전환 캐시 오염의 근원(최근 커밋 2건이 이 문제 대응). ↓ 추천 3 |
| `rt-ui-storage` | `customMapData`(맵 아이템 배열 전체!), customMapMeta/Title | 대형 맵에서 localStorage 5MB 한도 위험. ↓ 추천 2 |
| `rt-saved-lists-v2` | 비로그인 참가자 명단 | 이미 서버 테이블(`participant_lists`) + 로컬→서버 마이그레이션 버튼 구현됨. 조치 불필요 |

### 마이그레이션 추천 (서버 저장 전환 후보)
1. **게임 설정 → `profiles.settings JSONB`**: 테마·폰트·볼륨·차분모드·전역 스킨이 기기별로 따로 놀고 있음. 로그인 유저에 한해 서버 동기화하면 다기기 일관성 확보. (프로필 stats 마이그레이션 `006_update_profiles_stats` 패턴 재사용)
2. **에디터→게임 브리지(`customMapData`) 탈-localStorage**: persist 대신 메모리 전달 또는 `user_maps` 임시 슬롯/IndexedDB. 대형 커스텀 맵의 용량 한도·부팅 시 무조건 파싱 비용 제거. *(커스텀 맵 스토어 제한 영역 — 설계 승인 후 진행)*
3. **inventoryStore에 `partialize` + `version` 도입**: userId 저장 제거, 서버(`hydrateFromServer`, 016_sync_and_inventory)를 단일 진실원으로. 계정 전환 캐시 오염 재발 원천 차단.

## 8. 실행 순서

| Phase | 내용 | 위험도 |
|---|---|---|
| 1 | §1 잔여 타입 에러 8곳 → `tsc` 0건 | 낮음 |
| 2 | §2 유령 파일 삭제(2건 + BlackMarket 확인 후) · lint --fix · §4 이미지 7개 삭제 | 낮음 (git으로 복구 가능) |
| 3 | §6 SQL: `017_gacha_logs.sql` 신설, 006 구버전 정리, reset_db 반영 | 중간 (DB 적용은 사용자가 Supabase에서 실행) |
| 4 | §3 `eslint-config-next@^15.5`, `.gitignore`에 PWA 산출물, `ignoreBuildErrors` 제거 | 낮음 |
| 5 | §7 추천 3(inventoryStore partialize) 적용, 추천 1·2는 승인 후 | 중간 |
| 검증 | `npm run typecheck` · `npm run lint` · `npm run build` · `npm test` + 인게임 수동 확인(레이스 카메라 연출, 에디터 패널 드래그, 상점 구매, 스토어 다운로드) | — |
