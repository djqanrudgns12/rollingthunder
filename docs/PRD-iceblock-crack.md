# PRD — 얼음블록(IceBlock) 균열/파괴 비주얼 리워크

> 상태: Draft · 작성일 2026-07-03 · 대상 기물: `iceblock` (얼음블록)
> 관련 문서: [docs/OBSTACLES.md](./OBSTACLES.md)

---

## 1. 배경 (Context)

얼음블록은 "공이 부딪히면 내구도(HP)가 닳고 결국 깨지는 블록"으로 설계됐지만, 실제 플레이에서 **깨지는 과정이 보이지 않는다.** 사용자가 보고한 3가지 문제:

1. 부딪혀도 **조금씩 균열이 생기는 모습이 없다.**
2. **HP가 깎일수록 균열이 심해지는** 단계적 표현이 필요하다.
3. 마지막에 박살 나면 **기물이 사라져야 한다.**

이 문서는 현재 구현을 정밀 분석해 근본 원인을 규명하고, "HP = 타격 횟수(예: HP 5 → 5번 치면 파괴, HP가 최대치면 온전, 깎일수록 단계적으로 갈라짐)" 규칙에 맞는 **단계적 균열 + 파괴 비주얼**을 구현하는 것을 목표로 한다.

의사결정(확정):
- **에셋 생성 방식**: 절차적 생성 스크립트 (`scripts/`에서 코드로 PNG 렌더링, 저장소 포함·재생성 가능).
- **단계 매핑**: 고정 N단계 에셋 + 손상비율(`d = 1 − hp/maxHp`) 매핑 → 임의의 maxHp에 자동 대응.

---

## 2. 현재 동작 분석 (As-Is)

### 2.1 데이터 모델
얼음블록의 내구도는 `hp` / `maxHp` 두 필드로만 표현된다. `cracks`·`stage` 같은 필드는 없고, **균열 정도는 렌더 시점에 `hp/maxHp`로 파생**한다.

- 런타임 바디: [src/engine/types.ts:25-26](../src/engine/types.ts#L25-L26) — `UserData.hp?`, `maxHp?`
- 에디터 아이템: [src/store/editorStore.ts:32-33](../src/store/editorStore.ts#L32-L33)
- 기본값: [src/components/editor/ToolboxPanel.tsx:127-128](../src/components/editor/ToolboxPanel.tsx#L127-L128) → `w:60, h:25, hp:3, maxHp:3`
- 에디터 노출 필드: [src/components/editor/InspectorPanel.tsx:276-280](../src/components/editor/InspectorPanel.tsx#L276-L280) — **내구도(HP) 한 개만** 노출

### 2.2 바디 생성 & HP 초기화
[src/engine/MapBuilder.ts:151-171](../src/engine/MapBuilder.ts#L151-L171) `createBreakableBlock` — 고정(static) cuboid 콜라이더, `restitution 0.1`, `friction 0.05`, 충돌 이벤트 구독. **주의**: `maxHp`가 `item.maxHp`가 아니라 `item.hp`에서 파생됨(line 168) → 에디터가 HP만 노출하므로 결과적으로 `maxHp === 시작 HP`로 일관됨(현 구조에서 문제 없음, 그대로 유지).

### 2.3 충돌·HP 감소 (핵심 런타임 로직)
[src/engine/SimulationCore.ts:457-478](../src/engine/SimulationCore.ts#L457-L478) — 충돌 상대가 **chip(공)**이고 `hp > 0`이며 **`impactV > 20`**일 때만 `hp--`. 매 타격 `ICE_CRACK` 이벤트(`remainingHp`, `maxHp`, `x`, `y`) emit, `hp <= 0`이면 `pendingRemovals`에 넣고 `ICE_DESTROY` emit.
- 실제 제거: [src/engine/SimulationCore.ts:621-630](../src/engine/SimulationCore.ts#L621-L630) `processPendingRemovals` → `world.removeRigidBody`.
- 스냅샷에 `hp`/`maxHp` 포함: [src/engine/SimulationCore.ts:236-237](../src/engine/SimulationCore.ts#L236-L237).

### 2.4 렌더 (공유 렌더러)
[src/lib/render/ObstacleRenderer.ts:202-229](../src/lib/render/ObstacleRenderer.ts#L202-L229) — `ice_block_base` 스프라이트(불투명) 위에 `ice_block_crack` 오버레이를 **additive blend**로 올리고, 초기 `crack.alpha = 1 − hp/maxHp`.

### 2.5 실시간 이펙트
[src/components/PhysicsCanvas.tsx:1402-1446](../src/components/PhysicsCanvas.tsx#L1402-L1446)
- `ICE_CRACK`: `crackOverlay.alpha`를 `1 − remainingHp/maxHp`로 GSAP 트윈 + 스케일 팝 + 흰 파티클 3개.
- `ICE_DESTROY`: 스프라이트 `scale→0`(back.in) 후 destroy + 하늘색 파편 15개. **→ 사라짐(요구사항 3)은 이미 동작.**
- 프리로드 등록: [src/components/PhysicsCanvas.tsx:317-318](../src/components/PhysicsCanvas.tsx#L317-L318), 에디터용 [src/components/editor/EditorCanvas.tsx:19-28](../src/components/editor/EditorCanvas.tsx#L19-L28).

### 2.6 에셋 실물
- `ice_block_base.png` (425KB) — 검은 배경 위 **네온 시안 사각형 + 큰 글로우 헤일로**.
- `ice_block_crack.png` (653KB) — **이미 완전히 박살 난 최종 모습**(중앙에 큰 구멍 + 떨어지는 파편).

### 2.7 근본 원인 (왜 균열이 안 보이는가)
1. **crack 에셋이 "최종 박살" 한 장**이다. 단계별 균열이 아니라 완성된 파괴 이미지를 `alpha`로만 흐리게 겹친다.
2. **Additive blend는 어두운 균열 틈을 표현하지 못한다.** 균열의 실체인 "검은 갈라짐 선"은 additive에서 0(무기여)이고, 밝은 파편 가장자리만 더 밝아진다 → 맞을수록 "갈라짐"이 아니라 **그냥 더 하얗게 발광**한다. (사용자 체감 "균열이 안 보임"의 정확한 원인)
3. **단계(stage) 개념이 없다.** 연속 alpha 페이드(0→0.66)라 HP가 5든 3이든 "단계적으로 갈라지는" 이산적 변화가 없다.
4. **base 에셋의 불투명 검은 배경 + 큰 여백/헤일로** 때문에 콜라이더(60×25, ≈2.4:1)에 맞춰 스케일하면 거의 정사각형인 소스가 찌그러지고 주변 검은 여백이 **게임 월드 위에 검은 박스로 그대로 렌더**됨. → **인게임에서 얇은 네온 바 주위에 검은 사각형이 보이는 아티팩트로 실제 확인됨**(사용자 스크린샷). 이것이 "배경깨짐"의 실체이며, **base 이미지 파일 자체를 재생성해야 함(필수)**.

---

## 3. 목표 동작 (To-Be) & 요구사항

| # | 요구사항 | 수용 기준 |
|---|---------|----------|
| R1 | 타격 시 점진적 균열 | 매 유효 타격마다 균열이 **눈에 띄게 한 단계** 진행 |
| R2 | HP에 비례한 균열 심화 | `hp == maxHp` → 온전(균열 0), `hp == 1` → 가장 심한 균열 |
| R3 | 파괴 시 소멸 | `hp == 0` → 셰터 연출 후 기물이 물리·렌더에서 완전히 사라짐 |
| R4 | 임의 HP 대응 | HP=3, 5, 10 어느 값이든 동일 에셋으로 단계적으로 동작 |
| R5 | 배경깨짐 없음 | (a) base는 **실루엣 밖 투명 + 안쪽 불투명 고체 얼음**으로 렌더 → 검은 박스 아티팩트 제거. (b) 균열은 **불투명 얼음 표면 위의 밝은 선**이어야 하며 배경이 비쳐 보이는 구멍/찢김이 없어야 함 |

**HP 시맨틱** (에디터에서 조정): 디자이너가 입력하는 `HP = N`은 "N번 치면 파괴". `maxHp = N`(온전 상태). 매 유효 타격 `hp--`, `hp == 0`에서 파괴.

---

## 4. 설계 (Design)

### 4.1 단계 모델 — 고정 N단계 + 손상비율 매핑
- 손상비율 `d = 1 − hp/maxHp ∈ [0, 1)`.
- 고정 균열 단계 수 `N = 4` (권장). 스테이지 인덱스:

  ```ts
  // hp == maxHp → 0(균열 없음, base만).  hp > 0 그 외 → 1..N.  hp == 0 → 파괴(스테이지 아님)
  const d = 1 - hp / maxHp;
  const stage = d <= 0 ? 0 : Math.min(N, Math.max(1, Math.round(d * N)));
  ```

- 예: `maxHp=5` → 타격마다 stage 1→2→3→4→파괴. `maxHp=3` → 1→3→파괴(일부 단계 스킵되나 매 타격 확실히 심화). 매핑 상수(`round`/`ceil`, `N`)는 **튜닝 포인트**로 스크립트 상수화.
- 핵심 변화: **alpha 페이드 폐기 → 스테이지별 crack 텍스처를 이산 교체**.

### 4.2 생성할 에셋 (절차적 스크립트)
새 스크립트 `scripts/genIceAssets.ts` (실행 `npx tsx scripts/genIceAssets.ts`)가 아래 PNG를 렌더링한다. 렌더러는 **`@napi-rs/canvas`**(프리빌트 바이너리, Windows 안전, devDependency 추가) 권장. *대안*: 이미 설치된 `playwright`로 무헤드 Chromium 캔버스에 그린 뒤 `toDataURL`로 저장(신규 의존성 0).

출력물 (`public/images/assets/obstacles/`):

| 파일 | 내용 |
|------|------|
| `ice_block_base.png` | **(필수 재생성)** 네온 얼음 블록. **실루엣 밖은 투명(alpha 0), 안쪽은 불투명 고체 얼음**, 글로우는 부드러운 alpha 감쇠. 검은 박스 제거. 종횡비 2.4:1 |
| `ice_block_crack_1.png` | 실금 몇 가닥 (가장 약함) |
| `ice_block_crack_2.png` | 균열 확산 |
| `ice_block_crack_3.png` | 균열망 조밀 |
| `ice_block_crack_4.png` | 파괴 직전 (가장 심함) |
| `ice_block_shatter.png` | 파괴 순간 프레임(선택) — `ICE_DESTROY` 연출 강화용 |

**스타일 사양 (R5 충족)**:
- 캔버스 종횡비를 기본 블록(60×25 ≈ 2.4:1)에 맞춤 (예: 480×200). 스케일 왜곡 최소화.
- **base**: 얼음 블록 실루엣 **안쪽은 불투명 고체 얼음**(시안 그라디언트 + 하이라이트), **실루엣 밖은 투명(alpha 0)**, 외곽 글로우는 부드러운 alpha 감쇠로 그려 어떤 배경 위에도 검은 박스 없이 얹힘. → 인게임 검은 박스 아티팩트 해소.
- **crack 오버레이**: 네온 시안(`#4dfdfd` 계열) 균열선 + `shadowBlur` 글로우. 밝은 선만 존재하므로 배경은 **불투명 검정** 유지 후 **additive blend**로 자연 소거(기존 파이프라인 호환) — 오버레이는 base 위에만 얹히므로 투명/불투명 어느 쪽이든 무방.
- 균열은 **불투명 얼음 위에 그린 밝은 선**만 존재. 관통 구멍·배경 노출 없음(`shatter` 프레임 제외).
- base와 모든 crack 단계는 **동일 좌표계·동일 블록 외곽**으로 렌더 → 단계 교체 시 얼음 외곽이 흔들리지 않음(절차적 생성의 핵심 이점). 시드 고정으로 재현성 확보.

### 4.3 렌더러 변경 — [src/lib/render/ObstacleRenderer.ts](../src/lib/render/ObstacleRenderer.ts#L202-L229)
- base 스프라이트는 plain sprite(블렌드 변경 없음) 유지 — 새 에셋이 **실루엣 밖 투명**이므로 alpha가 자연 합성되어 검은 박스가 사라짐. 코드 변경 없이 에셋 교체만으로 개선.
- crack 오버레이 스프라이트 한 개(`label:'crackOverlay'`, additive)를 두되, **초기 텍스처를 스테이지 계산으로 선택**:
  - `stage(hp, maxHp)` 계산 → `stage===0`이면 오버레이 숨김(`visible=false`), 아니면 `ice_block_crack_{stage}` 텍스처 지정, `alpha=1`.
- 런타임 핸들러가 `maxHp`/`N`을 알 수 있도록 컨테이너에 메타 보존(예: `container.__ice = { maxHp, N }`) 또는 `ICE_CRACK` payload의 `maxHp` 사용(이미 전달됨).

### 4.4 런타임 변경 — [src/components/PhysicsCanvas.tsx:1402-1414](../src/components/PhysicsCanvas.tsx#L1402-L1414) (`ICE_CRACK`)
- **alpha 트윈 폐기.** `remainingHp`/`maxHp`로 `stage` 계산 → `crackOverlay.texture = getTexture(ice_block_crack_{stage})`, `visible=true`, `alpha=1`. 스테이지 교체 순간 짧은 스케일 팝(기존 0.2s) + 파티클 유지.
- 텍스처는 프리로드된 캐시에서 조회(추가 로드 없음).
- `ICE_DESTROY` 핸들러는 **변경 없음**(이미 소멸 동작). `shatter` 프레임을 쓰면 destroy 직전 1프레임 교체 후 스케일아웃(선택).

### 4.5 에셋 프리로드 등록
- [src/components/PhysicsCanvas.tsx:317-318](../src/components/PhysicsCanvas.tsx#L317-L318): `ice_block_crack` 대신 `ice_block_crack_1..4`(+`ice_block_shatter`) 추가.
- [src/components/editor/EditorCanvas.tsx:19-28](../src/components/editor/EditorCanvas.tsx#L19-L28): `OBSTACLE_TEXTURES` 목록 동일 갱신(에디터 미리보기도 공유 렌더러 사용).

### 4.6 에디터 인스펙터 (선택 개선)
[src/components/editor/InspectorPanel.tsx:276-280](../src/components/editor/InspectorPanel.tsx#L276-L280) — HP 필드는 이미 있음. "N번 치면 파괴" 보조 설명/최소값 1 클램프 정도만 선택적으로 보강.

### 4.7 헤드리스 시뮬레이터
[scripts/simulate.ts](../scripts/simulate.ts)는 얼음 HP/균열을 모델링하지 않음(순수 밸런스 지표). **변경 불필요.**

---

## 5. 파일별 변경 요약

| 파일 | 변경 |
|------|------|
| `scripts/genIceAssets.ts` (신규) | base + crack_1..4 + shatter PNG 절차적 렌더 |
| `package.json` | `@napi-rs/canvas` devDependency 추가(또는 playwright 활용) |
| `public/images/assets/obstacles/ice_block_*.png` | base 재생성 + 단계별 신규 에셋 |
| `src/lib/render/ObstacleRenderer.ts` | alpha 페이드 → 스테이지 텍스처 선택 로직 |
| `src/components/PhysicsCanvas.tsx` | `ICE_CRACK` 스테이지 교체 + 프리로드 목록 |
| `src/components/editor/EditorCanvas.tsx` | `OBSTACLE_TEXTURES` 목록 갱신 |
| `src/components/editor/InspectorPanel.tsx` (선택) | HP 필드 설명/클램프 |

**공용 상수화**: `N`(단계 수)과 `stage(hp,maxHp)` 함수를 `src/lib/render`의 한 곳(예: `ObstacleRenderer.ts` 상단 export)에 정의해 렌더러·런타임·생성 스크립트가 **동일 공식**을 참조하도록 한다(불일치 방지).

---

## 6. 검증 (Verification)

1. `npx tsx scripts/genIceAssets.ts` 실행 → 6종 PNG 생성 확인(뷰어로 단계별 균열 심화 육안 확인, 배경 불투명·구멍 없음).
2. `npm run dev` → 에디터에서 얼음블록 배치, 인스펙터에서 **HP=5**로 설정.
3. 레이스 실행: 공이 얼음블록을 칠 때마다 **균열이 1→2→3→4 단계로 눈에 띄게 심화**되고, 5번째 타격에서 **셰터 연출 후 완전히 사라지는지** 확인(R1–R3).
4. **HP=3**으로 재실험 → 온전(3) 상태에서 균열 0, 타격마다 심화, 3번째에 파괴(R2, R4).
5. 에디터 미리보기(정지 화면)에서 HP를 3↔5로 바꿔가며 초기 균열 표시가 `stage(hp,maxHp)`와 일치하는지 확인.
6. 얼음블록을 밝은/어두운 배경 맵 양쪽에 배치해 **검은 박스·배경 노출 아티팩트가 없는지**(R5) 확인.

---

## 7. 리스크 / 오픈 이슈
- **매핑 균등성**: `maxHp`가 `N`과 배수 관계가 아니면 일부 단계가 스킵됨(예: maxHp=3, N=4). 매 타격 "심화"는 보장되나, 완전 균등을 원하면 `N`을 늘리거나 `maxHp` 상한 가이드 제시.
- **에셋 아트 품질**: 절차적 렌더는 기존 AI 아트 대비 기하학적으로 보일 수 있음 → `shadowBlur`·다중 패스·미세 지터로 네온 질감 근접(스크립트 튜닝 영역).
- **`@napi-rs/canvas` 설치**: 네이티브 프리빌트 다운로드. 사내 네트워크 제약 시 playwright 대안으로 전환.
