# PRD — 얼음블록(IceBlock) 균열/파괴 비주얼

> 상태: **v2 (근본 원인 확정·수정 반영)** · v1 2026-07-03 / v2 2026-07-04 · 대상 기물: `iceblock` (얼음블록)
> 관련 문서: [docs/OBSTACLES.md](./OBSTACLES.md)

---

## 0. v2 변경 이력

- **v1 (2026-07-03)**: 균열 비주얼 리워크 설계 — 절차적 에셋 생성(`scripts/genIceAssets.ts`), 단계(stage) 모델, alpha 페이드 폐기 → 이산 텍스처 교체. **이 설계는 구현 완료됨** (에셋 6종 존재, `iceStage`/`iceCrackTexName` 공용 export, 핸들러의 단계 교체 로직 작성).
- **v2 (2026-07-04)**: 리워크가 완료됐음에도 **인게임에서 여전히 균열/소멸이 보이지 않는 문제**의 근본 원인을 확정하고 수정. v1 §2.5의 "ICE_DESTROY 소멸은 이미 동작" 진단은 **오진**이었음을 정정.

---

## 1. 배경 (Context)

얼음블록은 "공이 부딪히면 내구도(HP)가 닳고 결국 깨지는 블록"이다. 요구 동작:

1. 타격마다 **단계적 균열**이 눈에 띄게 심화 (`hp/maxHp` 기반 stage 1..4).
2. **HP 소진 시 셰터 연출 후 기물이 물리·렌더 양쪽에서 완전히 사라짐.**

v1 리워크(에셋·단계 로직) 이후에도 인게임에서 두 효과 모두 **전혀 적용되지 않는 문제가 반복 재발**했다. 이 문서는 그 근본 원인과 확정 수정안을 기록한다.

---

## 2. 현재 구현 상태 (As-Is, v2 기준)

### 2.1 정상 동작이 확인된 체인 (물리/데이터/에셋 — 문제 없음)

| 단계 | 위치 | 상태 |
|---|---|---|
| 에디터 HP 설정 (기본 3) | `ToolboxPanel.tsx`, `InspectorPanel.tsx` | ✅ |
| 바디 생성 + `COLLISION_EVENTS` 구독 | `MapBuilder.ts` `createBreakableBlock` (`userData: {type:'iceblock', id, hp, maxHp}`) | ✅ |
| 충돌 → HP 감소 (쿨다운 8프레임, 최소 임팩트 가드) | `SimulationCore.ts` `handleCollisions()` iceblock 분기 | ✅ |
| `ICE_CRACK` emit (`{id, remainingHp, maxHp, x, y}`) | `SimulationCore.ts` | ✅ |
| `hp<=0` → `ICE_DESTROY` emit + `pendingRemovals` → `world.removeRigidBody` (물리 소멸) | `SimulationCore.ts` `processPendingRemovals()` | ✅ |
| 워커 → 메인 이벤트 전달 | `physics.worker.ts` `flushEvents()` | ✅ |
| 에셋 존재 + 프리로드 | `public/images/assets/obstacles/ice_block_base·crack_1..4·shatter.png`, `PhysicsCanvas.tsx` `texturesToLoad` | ✅ |
| `crackOverlay` 스프라이트 생성 + 초기 stage 반영 | `ObstacleRenderer.ts` ice 분기 (`label:'crackOverlay'`) | ✅ |
| 단계 공식 공용화 | `ObstacleRenderer.ts` `ICE_CRACK_STAGES=4`, `iceStage(hp,maxHp)`, `iceCrackTexName(stage)` | ✅ |

### 2.2 근본 원인 — 스프라이트 조회가 죽어 있었음 (유일한 결함)

`PhysicsCanvas.tsx`의 `ICE_CRACK` / `ICE_DESTROY` 핸들러가 기물의 PIXI 노드를 다음 패턴으로 찾고 있었다:

```ts
const target = viewport.getChildAt(0).children.find(c => (c as any).label === payload.id); // ❌
```

- `viewport.getChildAt(0)`은 **배경 스프라이트(`bgSprite`, zIndex -100)** — 자식이 없다. (`viewport.sortableChildren = true`라 인덱스 기반 접근 자체가 불안정하며, 정렬 전·후 어느 경우에도 기물 컨테이너가 index 0이 아님.)
- 기물 노드는 실제로 `staticContainer`(zIndex -10)의 자식이며, 생성 시 **`graphicsMap`(id → node)에 이미 등록**된다. 워커가 보내는 `payload.id`와 키가 일치함을 확인했다.
- 따라서 `target`은 **항상 `undefined`** → `if (target)` 내부의 균열 텍스처 교체, 스케일 팝, shatter 프레임, `target.destroy()`(시각 소멸)가 **한 번도 실행된 적이 없다.** 물리 바디만 사라지고 스프라이트는 남는, 사용자가 보고한 증상과 정확히 일치.
- `if (target)` 밖에 있던 파티클 루프만 실행돼 "파편만 튀고 블록은 멀쩡한" 상태였다.

### 2.3 왜 반복 재발했는가

과거 수정들(`eda54e1 "ice fix"`, `680b622 "아이스블록 수정"`)과 v1 PRD는 모두 죽은 `if (target)` 가드의 **내부** 로직만 개선했다(alpha 페이드 → 단계 텍스처 등). 가드 위의 조회 한 줄이 실행을 통째로 차단하고 있었으므로, 내부를 아무리 고쳐도 인게임 변화가 없었다. 동일한 죽은 패턴이 `bumperHit` 셰이크, `FLIPPER_SWING`, `LUCKY_EFFECT` 게이트 펄스에도 있어 해당 연출들도 조용히 무동작이었다.

---

## 3. 수정 설계 (v2에서 적용 완료)

### 3.1 조회 경로 단일화 — `graphicsMap.get(id)`

`PhysicsCanvas.tsx`에서 5곳의 `viewport.getChildAt(0).children.find(...)`를 전부 교체:

| 핸들러 | 교체 후 |
|---|---|
| `ICE_CRACK` | `graphicsMap.get(payload.id)` |
| `ICE_DESTROY` | `graphicsMap.get(payload.id)` |
| `bumperHit` 셰이크 | `graphicsMap.get(payload.targetId)` |
| `FLIPPER_SWING` | `graphicsMap.get(payload.id)` |
| `LUCKY_EFFECT` 게이트 펄스 | `graphicsMap.get(payload.gateId)` |

다운스트림(단계 텍스처 교체·shatter·scale-out·destroy·파티클)은 v1에서 이미 올바르게 구현되어 있었으므로 조회만 살리면 전 체인이 동작한다.

### 3.2 소멸 위생 (`ICE_DESTROY`)

- `graphicsMap.delete(payload.id)` — 파괴된 노드로의 후속 조회 방지.
- 미니맵 마커(`movingObstacleMinimaps.get(payload.id)`)도 `destroy()` 후 map에서 delete — 파괴된 얼음이 미니맵에 잔존하지 않게.
- gsap `onComplete`의 `target.destroy()`에 `if (!target.destroyed)` 가드 — 언마운트 정리와 트윈 완료가 겹칠 때 이중 파괴 방지.

### 3.3 재발 방지 원칙 (필수 준수)

> **기물/칩 노드 조회는 반드시 `graphicsMap.get(id)` 단일 경로를 사용한다.**
> `viewport.getChildAt(n)` 등 **인덱스·계층 위치 기반 탐색은 금지** — viewport는 `sortableChildren=true`라 자식 순서가 zIndex 정렬로 계속 바뀌고, 레이어 구성 변경(배경/바닥/기물 컨테이너 추가)에도 취약하다. 새 이벤트 핸들러를 추가할 때 이 원칙을 지키면 본 버그 계열은 구조적으로 재발하지 않는다.

### 3.4 단계 모델 (v1에서 확정, 변경 없음)

- `d = 1 − hp/maxHp`, `stage = d<=0 ? 0 : min(4, max(1, round(d*4)))`, `hp<=0 → 4`(소멸은 `ICE_DESTROY` 담당).
- 렌더러·런타임이 `ObstacleRenderer.ts`의 `iceStage`/`iceCrackTexName`를 공용 참조 — 공식 불일치 없음.
- 임의 `maxHp`(3, 5, 10…) 자동 대응. `maxHp`가 4와 배수 관계가 아니면 일부 단계 스킵 가능하나 매 타격 심화는 보장.

---

## 4. 검증 체크리스트

1. `npx tsc --noEmit` — `PhysicsCanvas.tsx` 신규 타입 에러 없음. ✅ (v2 수정 시 확인)
2. `npm run dev` → 얼음 블록이 포함된 맵으로 레이스 실행:
   - [ ] **균열**: 마블 타격마다 `crack_1..4` 단계가 눈에 띄게 심화 + 스케일 팝 + 흰 파티클.
   - [ ] **소멸**: HP 소진 시 shatter 프레임 → `back.in` 스케일아웃으로 스프라이트 완전 소멸 + 파란 파편 15개. 마블이 그 자리를 **통과**(물리 소멸 동기 확인).
   - [ ] **미니맵**: 파괴된 얼음 마커가 미니맵에서도 제거됨.
3. 에디터에서 HP=5로 변경 후 재실험 — 5타에 걸쳐 단계 심화 → 파괴.
4. 부수 소생 연출: 범퍼 타격 스케일 셰이크, 플리퍼 스윙 팝, 럭키게이트 펄스가 이제 동작함(기존엔 동일 버그로 무동작). 과하게 느껴지면 개별 톤다운.
5. 시각 오류: 균열 오버레이가 블록 외곽과 정합(동일 좌표계 에셋), 파괴 후 잔상·검은 박스 없음.

---

## 5. 잔여 리스크 / 오픈 이슈

- **단계 스킵**: `maxHp`가 4의 배수가 아니면 일부 단계가 건너뛰어짐(허용 범위, v1 §7 참조).
- **파괴 효과음**: 현재 `ui_door_slam` 사용. 전용 에셋 `public/sounds/sfx/gmk_ice_break.mp3`가 존재하므로 soundManager에 등록해 교체하는 개선 여지(선택).
- **부수 소생 연출의 톤**: 범퍼/플리퍼/럭키게이트 연출이 처음으로 실제 표시되므로, 플레이테스트에서 과하다고 판단되면 수치(스케일 배율·지속시간)만 조정.
