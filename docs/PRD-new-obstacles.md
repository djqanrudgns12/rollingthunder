# PRD — 신규 장애물(기물) 10종 추가

> 작성일: 2026-07-14 · 상태: 승인됨(구현 대기) · 범위: 에디터 배치 전용 + 상점 판매

## 1. Context (배경)

Rolling Thunder는 칩(chip)이 중력을 받아 낙하하며 결승선까지 경주하는 사이드뷰 물리 레이스 게임이다. 현재 18종의 게임플레이 장애물이 존재하며, 그중 7종(풍차·피스톤·송풍기·포탈·럭키/스피드/슬로우게이트)은 상점의 `piece`(프리미엄 전용) 탭에서 칩으로 구매한다.

콘텐츠 다양성과 상점 수익 포인트를 늘리기 위해 **기존 기능·비주얼과 겹치지 않는 창의적 신규 장애물 10종**을 추가한다. 모두 기본 보유가 아닌 **상점 구매형(프리미엄 전용 탭, 노말~레전더리 + Mythic 1종)**으로 배치하고, 에디터에서 배치해 실제 게임에서 정상 작동하도록 전역 파이프라인에 통합한다.

**핵심 기술 스택(확정 버전):** 물리 `@dimforge/rapier2d-compat` ^0.19.3 (Web Worker), 렌더 `pixi.js` ^8.19.0, 상태 `zustand` ^5.0.14, `next` ^15.1.4, `@supabase/ssr` ^0.12.0, PNG 생성 `@napi-rs/canvas` ^1.0.2.

### 확정된 스코프 결정 (사용자 승인)
- **에셋:** 고퀄리티 "히어로" 5종은 **PNG 생성 스크립트**(`@napi-rs/canvas`, **진짜 알파 투명** — 가짜 체커보드/엑박 없음), 나머지 5종(존/이펙트형)은 **인라인 SVG 아이콘 + PIXI.Graphics 프로시저럴**.
  - ⚠️ **보고(워크플로 규칙 1):** 본 환경에는 AI 이미지 생성 엔진이 없어, PNG는 코드로 그리는 절차적 생성기(`scripts/genIceAssets.ts`와 동일 방식)로 제작한다. `@napi-rs/canvas`는 `clearRect`로 실루엣 밖 alpha=0을 보장하므로 투명은 진짜다. 만약 특정 자산에서 깨끗한 투명이 불가하면 즉시 코멘트하거나 배경 제거를 요청한다.
- **티어:** 노말~레전더리 분배 + **장애물 최초의 Mythic 캡스톤 1종** 추가.
- **적용 범위:** **에디터 수동 배치 전용 + 상점 판매**(Group A/B). 랜덤 맵 자동 생성(GimmickInjector 등, Group C)은 **건드리지 않음.**

---

## 2. 신규 장애물 10종 명세

> 설계 원칙: (a) 기존 18종과 기능·비주얼 중복 금지, (b) Rapier 0.19 + 기존 이펙트 패턴만으로 구현 가능(동적 조인트/파괴 지형 등 난이도·불안정 항목 배제), (c) 값 튜닝 가능 + 전역 속도 클램프(`clampVelocities`)·anti-stuck 보호 하에서 밸런스 안전.

각 항목의 "패턴"은 재사용할 기존 코드 경로를 가리킨다.

### 필드 이펙트형 (AABB 센서 + 매 프레임 `applyX()` — `applyWindCannons` 패턴 재사용)

**① 컨베이어 벨트 `conveyor`** — Rare / 1,500C / **PNG(256×64 타일)**
- 효과: 영역 내 칩의 속도를 벨트 방향(`angle`)·강도(`speed`)의 접선 속도로 블렌딩해 옆으로 실어 나른다(경로 강제 우회).
- 필드: `w`, `h`, `angle`, `speed`. 렌더: `TilingSprite` 스크롤(피스톤 방식).
- 차별점: 부스터=1회성 Δv, 송풍기=주기적 밀기. 벨트=**지속적 측면 운송**.

**② 점착 슬라임 `sticky`** — Rare / 1,500C / **SVG+프로시저럴**
- 효과: 영역 내 칩 속도에 매 프레임 감쇠(`v *= 1 - drag`) 적용. 나가면 즉시 원복(상태 저장 불필요).
- 필드: `w`, `h`, `force`(감쇠율). 렌더: 반투명 초록 젤리 + 기포.
- 차별점: 슬로우게이트=통과 시 1회성 10초 디버프. 슬라임=**머무는 동안만** 감속.

**③ 무중력 존 `zerog`** — Epic / 2,500C / **SVG+프로시저럴**
- 효과: 영역 내 칩 `setGravityScale(0)` → 부유/관성 활공. **퇴장 시 1.0 원복**(아래 §5 주의).
- 필드: `w`, `h`. 렌더: 반투명 보라/시안 버블 + 부유 파티클.
- 차별점: 기존 중력 무효 존 없음. ④와 페어(블랙홀/화이트홀식 대칭).

**④ 중력 강화 존 `heavyg`** — Epic / 2,500C / **SVG+프로시저럴**
- 효과: 영역 내 칩 `setGravityScale(~2.5)` → 급강하 레인. 퇴장 시 원복. ③과 동일 `applyGravityZones()`가 처리.
- 필드: `w`, `h`. 렌더: 반투명 적/주황 하강 스트릭.

**⑩ 초신성 펄사 `supernova`** — **Mythic** / 8,000C / **PNG(256×256, 히어로)**
- 효과: 고정 중심에서 `onFrames/offFrames` 주기로 **대반경 방사형 충격파**를 방출, 반경 내 전 칩을 바깥으로 밀어냄(주기적 광역 넉백). 펄스 시 `SUPERNOVA_PULSE` 이벤트로 확장 링 연출.
- 필드: `radius`, `force`, `onFrames`, `offFrames`. 렌더: 맥동 코어 + gsap 충격파 링.
- 차별점: 지뢰=접촉 트리거 국소, 블랙홀=지속 흡인. 펄사=**중심 고정·타이머 기반 대규모 AoE**(캡스톤).

### 접촉 트리거형 (센서 + `handleCollisions` 분기)

**⑤ 함정문 `trapdoor`** — Epic / 2,500C / **SVG+프로시저럴**
- 효과: 평소 단단한 바닥(solid). `onFrames/offFrames` 타이머로 콜라이더 `setEnabled(false)`↔`true` 토글 → 열릴 때 칩이 통과 낙하. (`applyTrapdoors()` — 힘 없음, 순수 지오메트리 + 타이밍)
- 필드: `w`, `h`, `angle`, `onFrames`, `offFrames`. 렌더: 여닫이 패널(TRAPDOOR_OPEN/CLOSE 이벤트로 gsap 개폐).
- 차별점: 구멍=상시 개방 페널티, 피스톤=이동 플랫폼. 함정문=**타이머 개폐 바닥**.

**⑥ 지뢰 `mine`** — Epic / 3,000C / **PNG(256×256, 히어로)**
- 효과: 칩 접촉 시(퍼-지뢰 쿨다운) **반경 내 모든 칩에 방사형 넉백 임펄스**(repel 로직 재사용) + `MINE_EXPLODE` 연출. 제거되지 않고 N프레임 후 재장전.
- 필드: `radius`(폭발), `force`(임펄스). 쿨다운은 `lastWarpFrame` 맵 재사용.
- 차별점: 럭키게이트 repel=단일칩 랜덤, 범퍼=탄성 반발. 지뢰=**다중칩 광역 넉백(혼돈)**.

**⑦ 캐논 `cannon`** — Legendary / 5,000C / **PNG(256×256, 히어로)**
- 효과: 칩이 입구 센서 진입 시 **포획**(중력 0·정지) → `chargeFrames` 후 **지정 각도로 고속 발사**(예약 해제 리스트 `cannonLaunches`, 홀 리스폰 스케줄 패턴 재사용). 칩별 예약이라 다중 발사 가능.
- 필드: `angle`(발사 방향), `power`(발사 속도). 렌더: 각도 회전 포신 + 충전 글로우 + `CANNON_FIRE` 머즐 플래시.
- 차별점: 부스터=통과 즉시 Δv(포획 없음). 캐논=**포획→충전→직사 발사**.

### 키네마틱 이동형 (`createKinematic` + `applyPistons` 시간축 + `MOVING_OBSTACLE_TYPES`)

**⑧ 진자 파괴추 `pendulum`** — Legendary / 5,000C / **PNG(256×256, 히어로 — 추. 사슬은 프로시저럴)**
- 효과: 고정 피벗(x,y)을 축으로 추가 **연속 진자 호(arc)** 왕복. 매 프레임 목표각 `θ = swingAngle·sin(phase·speed)`, 추 위치 `pivot + length·(sinθ, cosθ)`를 `setNextKinematicTranslation`으로 이동. CCD로 관통 방지(풍차와 동일).
- 필드: `length`(팔 길이), `swingAngle`(진폭°), `speed`(속도). `OBSTACLE_FRAME`로 추 위치 브로드캐스트, 렌더러가 피벗→추 사슬을 매 프레임 재드로우.
- 차별점: 풍차/스피너=360° 회전, 플리퍼=트리거 스윙, 피스톤=직선. 진자=**연속 진자 호**.

### 정적 특수 표면

**⑨ 빙판 지대 `icerink`** — Rare / 1,500C / **SVG+프로시저럴**
- 효과: `friction≈0` 고정 큐보이드(solid). 위에 얹히거나 스치는 칩이 접지력을 잃고 미끄러짐. SimulationCore 이펙트 불필요(재질 속성만) — 최소 배선.
- 필드: `w`, `h`, `angle`. 렌더: 반투명 백청색 얼음판 + 광택 시트.
- 차별점: 얼음블록=파괴형 블록. 빙판=**미끄러운 정적 표면**.

### 티어·가격·에셋 요약

| # | ID | 이름 | 티어 | 가격 | 에셋 | 구현 패턴 |
|---|----|------|------|------|------|-----------|
| ① | `conveyor` | 컨베이어 벨트 | Rare | 1,500 | PNG 타일 | 필드 `applyConveyors` |
| ② | `sticky` | 점착 슬라임 | Rare | 1,500 | SVG+프로시저럴 | 필드 `applySticky` |
| ⑨ | `icerink` | 빙판 지대 | Rare | 1,500 | SVG+프로시저럴 | 정적 friction=0 |
| ③ | `zerog` | 무중력 존 | Epic | 2,500 | SVG+프로시저럴 | 필드 `applyGravityZones` |
| ④ | `heavyg` | 중력 강화 존 | Epic | 2,500 | SVG+프로시저럴 | 필드 `applyGravityZones` |
| ⑤ | `trapdoor` | 함정문 | Epic | 2,500 | SVG+프로시저럴 | 토글 `applyTrapdoors` |
| ⑥ | `mine` | 지뢰 | Epic | 3,000 | **PNG 히어로** | 충돌 `handleCollisions` |
| ⑦ | `cannon` | 캐논 | Legendary | 5,000 | **PNG 히어로** | 충돌+예약 `cannonLaunches` |
| ⑧ | `pendulum` | 진자 파괴추 | Legendary | 5,000 | **PNG 히어로** | 키네마틱 `applyPistons` |
| ⑩ | `supernova` | 초신성 펄사 | Mythic | 8,000 | **PNG 히어로** | 필드 `applySupernovas` |

가격 근거: 기존 사다리(Rare 1,000–1,500 / Epic 2,500 / Legendary 5,000 / Mythic 8,000 `frame_plasma`)와 정렬. 모든 항목 `requiresPremium: true`, `isDefault` 미지정 → 프리미엄 전용 탭에서 구매만 가능(기본 미보유).

---

## 3. 구현 아키텍처 — 전역 통합 체크리스트

신규 타입 1종당 아래 경로를 모두 손봐야 "에디터 배치→물리 작동→렌더→상점 판매"가 전역 성립한다.

### Group A — 코어(전 항목 필수)
1. **`src/store/editorStore.ts`** — `EditorItemType` 유니온(L15)에 10개 타입 추가 + `EditorItem`(L20~54)에 신규 필드 추가(대부분 기존 `w/h/angle/speed/force/radius/onFrames/offFrames/length/swingAngle` 재사용, 신규 없음 목표).
2. **`src/engine/types.ts`** — `UserData.type` 유니온(L2)에 10개 추가 + 필요한 런타임 필드.
3. **`src/components/editor/ToolboxPanel.tsx`** — `CATEGORIES.obstacles`(L20~36)에 `ItemDef` 10개 + `handleAddItem` 스위치(L125~163)에 기본 지오메트리 10개.
4. **`src/components/editor/InspectorPanel.tsx`** — 타입별 속성 편집 블록 10개(기존 L167~286 패턴). 필드가 겹치는 존형은 공통 블록 재사용.
5. **`src/engine/MapBuilder.ts`** — 팩토리 추가:
   - 센서 필드형(`conveyor/sticky/zerog/heavyg/supernova`): `createSensor` 확장(이벤트 불필요, 위치 스캔형).
   - 충돌형(`mine/cannon`): `createSensor` + `setActiveEvents(COLLISION_EVENTS)`(포탈/부스터와 동일).
   - 토글 바닥(`trapdoor`)·정적표면(`icerink`): `createRect` 변형(트랩도어는 콜라이더 핸들 보관, 빙판은 `friction≈0`).
   - 키네마틱(`pendulum`): `createKinematic` + CCD, 피벗/암 길이 userData 보관.
6. **`src/engine/SimulationCore.ts`** — 다중 지점:
   - `init()` 디스패치(L319~353)에 타입→팩토리 라우팅 10개.
   - `cacheGimmickBodies()`(L581~607)에 버킷 추가: `cachedConveyors / cachedSticky / cachedGravityZones(zerog+heavyg) / cachedTrapdoors / cachedSupernovas`, 그리고 `pendulum`은 `cachedKinematics`에 합류.
   - `internalStep()`(L481~491)에 호출 추가: `applyConveyors() / applySticky() / applyGravityZones() / applyTrapdoors() / applySupernovas() / processCannonLaunches()`.
   - `handleCollisions()`: 센서 허용목록(L758~759)에 `'mine','cannon'` 추가 + 각 분기 구현(지뢰 광역 넉백 / 캐논 포획+예약).
   - `applyPistons()`(L1204~)에 `pendulum` 분기(호 위치 이동) 추가.
   - `MOVING_OBSTACLE_TYPES`(L132)에 `'pendulum'` 추가.
   - `mapData` 스냅샷 화이트리스트(L364~388)에 렌더러가 쓰는 신규 필드 누락 없이 복사(⚠️ 이 화이트리스트 누락 시 필드가 렌더러에 전달되지 않음 — 기존 windAngle 버그 주석 참조).
7. **`src/lib/render/ObstacleRenderer.ts`** — `createObstacleGraphic`에 `else if (item.type === ...)` 10개(PNG 스프라이트 5 / 프로시저럴 PIXI.Graphics 5) + 미니맵 그래픽.

### Group B — 에셋 & 연출
8. **PNG 생성 스크립트 신설** `scripts/genObstacleAssets.ts` (`genIceAssets.ts` 복제·확장) → `public/images/assets/obstacles/`에 `obstacle_conveyor.png`(256×64), `obstacle_mine.png`, `obstacle_cannon.png`, `obstacle_pendulum.png`, `obstacle_supernova.png`(각 256×256). `@napi-rs/canvas` `clearRect`로 **진짜 알파 투명** 보장. 실행: `npx tsx scripts/genObstacleAssets.ts`.
9. **`src/lib/SvgAssets.ts`** — SVG형 5종(`sticky/icerink/zerog/heavyg/trapdoor`) 상점 아이콘 data-URI 추가(기존 gate/windcannon와 동일 base64 인라인 방식 → 엑박·가짜투명 원천 차단).
10. **프리로드 목록** — PNG 5개 URL을 **양쪽** 매니페스트에 추가: `src/components/PhysicsCanvas.tsx` `texturesToLoad`(~L561) + `src/components/editor/EditorCanvas.tsx` `OBSTACLE_TEXTURES`(~L22).
11. **연출 이벤트 핸들러** — `src/components/PhysicsCanvas.tsx` 워커 `onmessage` 스위치(~L1824~1957)에 `MINE_EXPLODE / CANNON_FIRE / SUPERNOVA_PULSE / TRAPDOOR_OPEN / TRAPDOOR_CLOSE` 분기 추가(기존 ICE_CRACK/FLIPPER_SWING/WIND_ON 패턴 재사용, gsap + PIXI 파티클).

### 상점/판매 (핵심 요구사항)
12. **`src/data/shopData.ts`** — `MOCK_ITEMS`의 `piece` 블록(L168 이후)에 10개 `ShopItem` 추가. 형식은 기존 판매 장애물과 동일:
```ts
{ item_id: "piece_conveyor", category: "piece", name: "컨베이어 벨트", price: 1500, rarity: "Rare",
  description: "…", image: SVG_ASSETS.conveyor /* 또는 "/images/assets/obstacles/obstacle_conveyor.png" */, requiresPremium: true },
// … 10종. Mythic 예: { item_id:"piece_supernova", …, price:8000, rarity:"Mythic", requiresPremium:true }
```
`item_id`는 반드시 `piece_<type>` 접두(서버가 `split('_')[0]='piece'`로 `item_type` 파생). `isDefault` 미지정 → 구매 전용.

### 문서
13. **`docs/OBSTACLES.md`** — 신규 10종 명세 섹션 추가.

---

## 4. DB / Supabase — 스키마 변경 없음

- 장애물·상점 아이템은 **코드가 원천(source of truth)**. DB는 소유(`user_inventory`)·장착(`profiles.equipped_piece`)만 저장하며 `item_code`는 자유 문자열(`VARCHAR(100)`, CHECK/enum 없음).
- 신규 `piece_*` 구매는 기존 원자 RPC `purchase_item_atomic`(`supabase/migrations/018_shop_performance.sql`)이 그대로 처리 → **새 마이그레이션/테이블/컬럼/시드 불필요.**
- 저장소에 supabase MCP·CLI 설정 없음(마이그레이션은 `NNN_*.sql` 수동 적용). 프로젝트 ref는 `.env.local`에 존재.
- (선택) 기존 유저에게 자동 지급하려면 백필 `INSERT INTO user_inventory …`가 필요하나, **요구사항은 "구매 전용/기본 미보유"이므로 하지 않는다.**

---

## 5. 밸런스 & 리스크

- **⚠️ 무중력/중력강화 존의 gravityScale 원복 충돌(최우선 주의):** 홀 함정·스턴 럭키효과도 `setGravityScale(0)`을 쓴다. 존 퇴장 시 무조건 `1.0`으로 되돌리면 **동결 중인 칩이 부활**할 수 있다. 해결: `applyGravityZones()`가 자기 소유 칩만 관리하는 `gravityZoneOwned: Set<chipId>`를 두고, 매 프레임 재계산하며 **홀 리스폰/스턴 상태 칩은 건너뛰고**, 퇴장 칩만 원복. (구현 시 필수 검증 케이스)
- **전역 보호막:** 모든 힘/임펄스는 `clampVelocities`(MAX_CHIP_SPEED)와 anti-stuck의 보호를 받음 → 컨베이어·슬라임·지뢰·펄사·캐논이 칩을 영구 포획/무한 가속시키지 않도록 강도 상한 + 쿨다운/스케줄 해제 보장.
- **키네마틱 관통:** 진자는 풍차와 동일하게 CCD 활성 필수.
- **성능:** 필드형은 `cacheGimmickBodies` 버킷을 통해 `forEachRigidBody` 전역순회 없이 처리(기존 최적화 규약 준수).
- **제외 항목(비현실/난이도):** 동적 revolute 조인트 시소·파괴형 지형·칩별 자석 극성·물리 유체 등은 Rapier 0.19 + 워커 아키텍처에서 불안정/과중하여 배제.
- **타입 동기화:** `EditorItemType`(editorStore)와 `UserData.type`(types.ts) 두 유니온을 반드시 함께 갱신.

---

## 6. 검증 (Verification)

1. **정적 검사:** `npm run typecheck`(tsc --noEmit) — 두 타입 유니온·신규 필드 정합.
2. **에셋:** `npx tsx scripts/genObstacleAssets.ts` 실행 → 생성된 5 PNG를 뷰어로 열어 **투명 배경(체커/블랙박스 없음)·엑박 없음** 육안 확인. 문제 시 사용자에게 코멘트/배경제거 요청.
3. **런타임(핵심):** `npm run dev` → `/editor`(프리미엄/관리자) 진입 → 신규 10종 각각 드래그 배치 → 테스트 플레이로 효과 확인:
   - 컨베이어 측면 운송 / 슬라임 감속·원복 / 무중력 부유·퇴장 원복 / 중력강화 급강하 / 함정문 타이머 개폐 낙하 / 지뢰 광역 넉백 / 캐논 포획→발사 / 진자 호 왕복 / 빙판 미끄러짐 / 펄사 주기 충격파.
   - **회귀 검증:** 홀·스턴으로 동결된 칩이 무중력 존을 지나도 부활하지 않는지(§5) 집중 확인.
4. **상점:** `/shop` `piece` 탭(프리미엄 계정) → 신규 10종이 올바른 티어 배지·가격으로 노출, **기본 미보유·구매 가능** 확인 → 1종 구매 → Supabase `user_inventory`에 `{item_type:'piece', item_code:'piece_<type>'}` 행 생성 확인.
5. **렌더:** 미니맵에 각 신규 장애물 표시 확인, 첫 프레임 텍스처 팝인 없음(프리로드 반영).

---

## 7. 변경 파일 요약

**신규:** `scripts/genObstacleAssets.ts`, `public/images/assets/obstacles/obstacle_{conveyor,mine,cannon,pendulum,supernova}.png`, `docs/PRD-new-obstacles.md`

**수정:** `src/store/editorStore.ts` · `src/engine/types.ts` · `src/engine/MapBuilder.ts` · `src/engine/SimulationCore.ts` · `src/lib/render/ObstacleRenderer.ts` · `src/lib/SvgAssets.ts` · `src/data/shopData.ts` · `src/components/editor/ToolboxPanel.tsx` · `src/components/editor/InspectorPanel.tsx` · `src/components/PhysicsCanvas.tsx` · `src/components/editor/EditorCanvas.tsx` · `docs/OBSTACLES.md`

**DB:** 변경 없음.
