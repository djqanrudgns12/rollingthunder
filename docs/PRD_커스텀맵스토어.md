# PRD — 등급별 맵에디터 개방 & 커스텀 맵 스토어

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 (2026-07-08) |
| 상태 | 승인됨 — 구현 대기 |
| 대상 릴리스 | 맵에디터 프리미엄 개방 + 커스텀 맵 스토어 |
| 관련 시스템 | 맵에디터, 상점, Supabase(profiles/maps/chips), 맵 로드 모달 |

---

## 1. 개요

### 1.1 배경 / 문제
- 맵에디터의 저장 기능은 현재 **admin 전용**이다 (`src/application/useCases/map/SaveMapUseCase.ts:17-22`에서 `role !== 'admin'`이면 거부. 주석에 "premium 확장 예정"이 이미 명시되어 있음).
- 일반 유저가 커스텀맵을 유통할 수 있는 유일한 경로는 **무인증 6자리 공유코드**(`EditorContainer.tsx`의 EXPORT → `map_presets` 테이블, `creator_id: 'guest'`)뿐이다. 인증도, 소유권도, 발견 가능성(discovery)도 없다.
- `profiles.role`은 이미 `'user' | 'premium' | 'admin'`을 지원하고 상점에서 premium 게이팅에 사용 중이지만, **premium 등급의 실질적 혜택이 빈약**하다.

### 1.2 목표
1. **premium 등급에게 맵에디터 개방** — 단, 기본맵(엔진 프리셋/공식맵)은 수정 불가, 커스텀맵 제작만 가능.
2. **커스텀 맵 스토어 신설** — premium 제작자가 맵을 배포하면 모든 로그인 유저가 100칩에 다운로드해 플레이.
3. **창작 보상 경제** — 다운로더가 지불한 100칩이 제작자에게 이전되는 P2P 칩 경제로 양질의 맵 제작 동기 부여 (시스템 칩 발행 없음 — 인플레이션 중립).
4. 레거시 공유코드 경로를 스토어 기반 유통으로 대체.

### 1.3 비목표 (Non-goals)
- 서버 측 재시뮬레이션 검증 (v1은 클라이언트 검증 결과 신뢰 — §9 참고)
- 결제/구독 시스템 (premium은 기존처럼 admin이 수동 부여)
- `map_presets` 테이블 DROP (읽기 전용 동결만)
- `MapEditorManager.tsx`(미라우팅 대체 셸) 정리

### 1.4 확정 정책 요약

| 정책 | 결정 |
|---|---|
| 배포 공개 시점 | **검증 통과 시 자동 공개** (헤드리스 시뮬 검증 게이트, 관리자 승인 없음) |
| 다운로드 비용 | **100칩 소모** (다운로더 잔액에서 차감, 최초 1회만 — 재다운로드·셀프 다운로드는 무료) |
| 제작자 보상 | **다운로드 1회당 100칩** (다운로더가 지불한 칩이 제작자에게 이전, 유저당 최초 1회, 셀프 다운로드 제외) — **UI에 정책 명시 필수** |
| 스토어 이용 권한 | 브라우징·다운로드: **모든 로그인 유저** / 배포: **premium·admin** |
| 개인 맵 저장 슬롯 | premium **10개**, admin 무제한 |

---

## 2. 아키텍처 결정

### 2.1 클린 아키텍처 유지 (기능만 구분 ❌)
코드베이스가 이미 클린 아키텍처를 따르고 있으므로 신규 기능도 동일 계층으로 구현한다:

```
core/entities → application/useCases → infrastructure/supabase(repositories)
→ presentation/actions(server actions) → components(client)
```

### 2.2 핵심 결정 사항

| 결정 | 선택 | 근거 |
|---|---|---|
| premium 맵 저장소 | **신규 `user_maps` 테이블** (기존 `maps` 확장 ❌) | `maps`는 admin 전용 공식맵 카탈로그로 무변경 유지. 권한 모델이 테이블 경계로 분리되어 RLS·UseCase 변경 최소화 |
| 스토어 공개 | `user_maps.is_published BOOLEAN` 플래그 (별도 store 테이블 ❌) | 단일 행 모델로 단순. 배포 상태 전환만으로 노출 제어 |
| 다운로드 방식 | **스냅샷 복사** (`user_map_downloads.snapshot JSONB`) | 제작자가 원본을 삭제·수정해도 다운로더는 무영향. 참조 방식 대비 엣지 케이스 대폭 감소 |
| 10슬롯 제한 | **DB 트리거(권위) + UseCase 사전 체크(UX)** 이중화 | 트리거가 최종 방어선, UseCase가 친절한 에러 메시지 |
| 검증 신뢰 모델 | 클라이언트가 기존 워커 기반 헤드리스 시뮬 실행 → 결과 요약 서버 제출 → 서버는 구조·통과 여부 검사 | 취미 프로젝트 실용주의. 서버 재시뮬은 향후 과제 |
| admin 저장 경로 | 기존 그대로 (`maps` 테이블, `saveMapAction`) | 회귀 위험 제로. premium만 신규 경로(`user_maps`) 사용 |
| 레거시 공유코드 | 쓰기 경로 제거(EXPORT 버튼 삭제), 테이블은 보존 | 배포 플로우가 대체. 파괴적 마이그레이션 회피 |

---

## 3. DB 마이그레이션 — `supabase/migrations/015_map_store.sql`

### 3.1 `user_maps` (개인 맵 + 스토어 배포 상태)

```sql
CREATE TABLE IF NOT EXISTS public.user_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
    description TEXT DEFAULT '',
    length_type TEXT NOT NULL DEFAULT 'Middle'
        CHECK (length_type IN ('Short','Middle','Long')),
    complexity  TEXT NOT NULL DEFAULT 'Medium'
        CHECK (complexity IN ('Simple','Medium','Complex')),
    world_height INTEGER DEFAULT 2400,
    wall_style TEXT DEFAULT 'straight',
    bg_image TEXT,
    theme_weights JSONB DEFAULT '{}'::jsonb,
    layout_config JSONB DEFAULT '{}'::jsonb,
    items JSONB DEFAULT '[]'::jsonb,
    schema_version INTEGER NOT NULL DEFAULT 1,   -- EditorItem 스키마 진화 대비
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    validation_summary JSONB,                    -- ValidationResult 요약
    validated_at TIMESTAMPTZ,
    download_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_user_maps_owner ON public.user_maps(owner_id);
CREATE INDEX idx_user_maps_store
    ON public.user_maps(is_published, download_count DESC) WHERE is_published = true;
CREATE INDEX idx_user_maps_store_recent
    ON public.user_maps(is_published, published_at DESC) WHERE is_published = true;
```

- `length_type`/`complexity` CHECK 값은 기존 `MapPresetMeta`(`src/engine/MapPresets.ts:25-42`)의 enum과 동일하게 유지한다.

### 3.2 `user_map_downloads` (스냅샷 복사)

```sql
CREATE TABLE IF NOT EXISTS public.user_map_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_map_id UUID REFERENCES public.user_maps(id) ON DELETE SET NULL,
    map_name TEXT NOT NULL,        -- 비정규화: 원본/제작자 삭제 대비
    creator_name TEXT NOT NULL,
    snapshot JSONB NOT NULL,       -- { schemaVersion, items, worldHeight, wallStyle,
                                   --   bgImage, layoutConfig, themeWeights,
                                   --   lengthType, complexity, description }
    downloaded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, source_map_id)  -- 유저당 맵 1회 기록 → 보상 파밍 1차 방어
);
CREATE INDEX idx_umd_user ON public.user_map_downloads(user_id, downloaded_at DESC);
```

### 3.3 `user_map_likes` + 토글 RPC

```sql
CREATE TABLE IF NOT EXISTS public.user_map_likes (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    map_id UUID NOT NULL REFERENCES public.user_maps(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, map_id)
);
-- toggle_user_map_like(p_map_id UUID) RPC (SECURITY DEFINER):
-- 존재하면 삭제 + like_count-1, 없으면 삽입 + like_count+1, 새 상태 반환
```

### 3.4 10슬롯 트리거

```sql
CREATE OR REPLACE FUNCTION public.enforce_user_map_slot_limit() RETURNS TRIGGER AS $$
DECLARE v_role TEXT; v_count INTEGER;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.owner_id;
  IF v_role = 'admin' THEN RETURN NEW; END IF;          -- admin 무제한
  SELECT count(*) INTO v_count FROM public.user_maps WHERE owner_id = NEW.owner_id;
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'MAP_SLOT_LIMIT: 개인 맵은 최대 10개까지 저장할 수 있습니다.';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_user_map_slot_limit BEFORE INSERT ON public.user_maps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_map_slot_limit();
```

### 3.5 RLS 정책

```sql
ALTER TABLE public.user_maps ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 소유 OR 배포된 맵 (로그인 유저만 스토어 열람)
CREATE POLICY user_maps_select ON public.user_maps FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR is_published = true);

-- INSERT: 본인 소유 + premium/admin 역할
CREATE POLICY user_maps_insert ON public.user_maps FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('premium','admin')));

-- UPDATE / DELETE: 본인 소유만 (admin 전체 접근은 014_admin_policies 패턴으로 별도 추가)
CREATE POLICY user_maps_update ON public.user_maps FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY user_maps_delete ON public.user_maps FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

ALTER TABLE public.user_map_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY umd_select ON public.user_map_downloads FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- INSERT는 download_user_map RPC(SECURITY DEFINER) 경유만 — 직접 INSERT 정책 없음
```

### 3.6 `download_user_map` RPC — 원자적 다운로드 + 제작자 보상 (핵심)

```sql
CREATE OR REPLACE FUNCTION public.download_user_map(p_map_id UUID)
RETURNS JSONB AS $$
DECLARE v_map RECORD; v_creator_name TEXT; v_snapshot JSONB; v_rows INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO v_map FROM public.user_maps
   WHERE id = p_map_id AND is_published = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAP_NOT_FOUND'; END IF;

  SELECT COALESCE(name, username, '알 수 없음') INTO v_creator_name
    FROM public.profiles WHERE id = v_map.owner_id;

  v_snapshot := jsonb_build_object(
    'schemaVersion', v_map.schema_version, 'items', v_map.items,
    'worldHeight', v_map.world_height, 'wallStyle', v_map.wall_style,
    'bgImage', v_map.bg_image, 'layoutConfig', v_map.layout_config,
    'themeWeights', v_map.theme_weights, 'lengthType', v_map.length_type,
    'complexity', v_map.complexity, 'description', v_map.description);

  INSERT INTO public.user_map_downloads
    (user_id, source_map_id, map_name, creator_name, snapshot)
  VALUES (auth.uid(), p_map_id, v_map.name, v_creator_name, v_snapshot)
  ON CONFLICT (user_id, source_map_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- 최초 다운로드 && 본인 맵 아님 → 다운로더 100칩 차감 + 제작자 100칩 지급 (칩 이전)
  -- deduct_chips가 잔액 부족 시 예외를 던지면 트랜잭션 전체 롤백 → 스냅샷도 미기록
  IF v_rows > 0 AND v_map.owner_id <> auth.uid() THEN
    PERFORM public.deduct_chips(auth.uid(), 100,
                                'map_download_' || p_map_id::text);
    UPDATE public.user_maps SET download_count = download_count + 1
     WHERE id = p_map_id;
    PERFORM public.add_chips(v_map.owner_id, 100,
                             'map_download_reward_' || p_map_id::text);
  END IF;

  RETURN jsonb_build_object('name', v_map.name, 'creatorName', v_creator_name,
                            'snapshot', v_snapshot, 'firstDownload', v_rows > 0);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

- `add_chips`/`deduct_chips`는 `006_chip_system.sql`에 이미 존재하는 RPC 재사용 (`chip_logs` 자동 기록). ⚠️ 구현 시 `deduct_chips`의 잔액 부족 동작(예외 vs false 반환)을 확인해 **부족 시 반드시 전체 롤백**되도록 작성 (false 반환형이면 `RAISE EXCEPTION 'INSUFFICIENT_CHIPS'` 분기 추가).
- 셀프 다운로드: 기록은 남지만(내 커스텀맵 탭 재활용) **차감/카운트/보상 없음**.
- 재다운로드: `ON CONFLICT DO NOTHING`으로 멱등 — 중복 과금·중복 보상 원천 차단.
- `profiles`에는 `username`/`name` 두 컬럼이 존재(`000_create_profiles.sql:6`) — `COALESCE(name, username)`으로 표시명 결정. 구현 시 UI에서 실제 쓰는 표시명 기준과 일치시킬 것.

---

## 4. 백엔드 계층

### 4.1 신규 파일

| 계층 | 파일 | 내용 |
|---|---|---|
| Entity | `src/core/entities/UserMap.ts` | `UserMapEntity` 인터페이스 (camelCase, `creatorName?` 조인 필드 포함) |
| Repository | `src/infrastructure/supabase/userMapRepository.ts` | 기존 `mapRepository.ts` 패턴(정적 메서드, snake↔camel 변환, DatabaseError 래핑): `save`, `findByOwner`, `findById`, `delete`, `countByOwner`, `findPublished({sort, search?, limit, offset})`(profiles 조인으로 creatorName), `publish(id, validationSummary)`, `download(mapId)`(RPC 호출), `findDownloads(userId)` |
| UseCase | `src/application/useCases/userMap/SaveUserMapUseCase.ts` | 로그인 → `role IN ('premium','admin')` → 이름 필수 → **id가 `MapPresets`에 존재하거나 공식맵이면 거부**(기본맵 덮어쓰기 서버 측 방어) → 신규 저장 시 premium이면 `countByOwner >= 10` 사전 체크("맵 슬롯이 가득 찼습니다 (10/10)") → save |
| UseCase | `.../PublishUserMapUseCase.ts` | 소유자 확인 → 검증 요약 서버 검사: `checks` 배열 존재 && `checks.every(c => c.ok)` && `races >= 8` → 통과 시 `publish()` / 미통과 시 ValidationError("맵 검증을 통과해야 배포할 수 있습니다") |
| UseCase | `.../GetMyUserMapsUseCase.ts` `GetStoreMapsUseCase.ts` `DownloadUserMapUseCase.ts` `GetMyDownloadsUseCase.ts` `DeleteUserMapUseCase.ts` | 각각 목록/스토어(비로그인 거부, 정렬·검색 위임)/다운로드(RPC)/받은맵/삭제(소유자 확인) |
| Server Action | `src/presentation/actions/userMapActions.ts` | 기존 `mapActions.ts`의 `{success, error, code}` 패턴으로 UseCase 래핑: `saveUserMapAction`, `publishUserMapAction`, `getMyUserMapsAction`, `deleteUserMapAction`, `getStoreMapsAction`, `downloadUserMapAction`, `getMyDownloadsAction`, `toggleMapLikeAction` |

### 4.2 기존 코드 변경
- `SaveMapUseCase.ts` — **로직 무변경** (admin 전용 유지). "premium 확장 예정" 주석만 신규 경로 안내로 갱신.
- 검증 신뢰 모델: 클라이언트가 `runValidationAsync`(`src/lib/editor/validationClient.ts:8`)로 헤드리스 시뮬 실행 → `ValidationResult`(`src/lib/editor/validationTypes.ts:9-18`: `races`, `checks: CheckRow[]{label, ok, value, target}` 등) 요약을 서버 제출. 조작 가능하나 피해가 "이상한 맵이 스토어에 노출" 수준이므로 v1 허용. **서버 재시뮬(scripts/simulate.ts 로직의 Node 러너)은 후속 과제로 코드 주석에 명시.**

---

## 5. 맵에디터 변경

### 5.1 역할 게이팅 매트릭스

| 기능 | admin | premium | user / guest |
|---|:---:|:---:|:---:|
| `/editor` 진입 | ✅ | ✅ | ❌ (redirect) |
| 기본맵(프리셋/공식맵) 편집·덮어쓰기 저장 | ✅ (기존 flow) | ❌ — **사본으로만 로드** | — |
| 커스텀 맵 저장 | ✅ (`maps`, 기존) | ✅ (`user_maps`, 10슬롯) | — |
| 테스트 플레이 · 검증 · 작업내역 · undo/redo 등 전 기능 | ✅ | ✅ (변경 없음) | — |
| 서버 배포 (공식맵 승격) | ✅ (기존 버튼) | ❌ | — |
| **스토어 배포 (신규 배포 버튼)** | ✅ | ✅ | — |

### 5.2 라우트 게이팅 — `src/app/editor/page.tsx`
- **async 서버 컴포넌트로 전환**: `createClient()`(server) → `auth.getUser()` + `UserRepository.getUserRole` → role이 `premium`/`admin`이 아니면 `redirect('/dashboard')` (기존 `src/app/admin/layout.tsx:15-32` 패턴 재사용).
- 기존 클라이언트 내용(dynamic import + 레이아웃)은 신규 `src/app/editor/EditorPageClient.tsx`(`'use client'`)로 이동, role을 prop으로 전달.
- ⚠️ **Next 15 함정**: 서버 컴포넌트에서 `dynamic(..., { ssr: false })` 사용 불가 → 클라이언트 컴포넌트 분리로 해결. 불확실하면 `node_modules/next/dist/docs/` 확인.

### 5.3 신규 컴포넌트

**`src/components/editor/SaveMapModal.tsx`** — 저장 버튼 클릭 시 오픈 (요구사항 5)
- 필드: **맵 이름**(필수, 탭 제목 프리필) / **설명**(textarea) / **길이 드롭다운**(Short=숏 · Middle=미들 · Long=롱) / **복잡도 드롭다운**(Simple=단순 · Medium=중간 · Complex=복잡) — 기본맵 메타(`MapPresetMeta`)와 동일 체계.
- premium이면 슬롯 게이지 `x/10` 표시.
- 배포된 맵 재저장 시 경고: "배포된 맵입니다. 저장 시 스토어에도 반영됩니다."
- `UnsavedChangesModal`의 "저장 후 닫기"도 이 모달 경유.

**`src/components/editor/PublishMapModal.tsx`** — 배포 버튼(저장 버튼 옆 신설) 클릭 시 (요구사항 4)
- 단계 진행 UI: ① 저장 확인(미저장 변경 시 SaveMapModal 선행) → ② **검증 중** — `runValidationAsync` 진행률 바(ValidationPanel 패턴 재사용, races 8회) → ③ 전체 통과 → `publishUserMapAction(mapId, result)` → "스토어에 배포되었습니다!" 토스트 / ④ 실패 → 미통과 체크 목록 + "검증을 통과해야 배포할 수 있습니다".
- **제작자용 안내 문구(필수)**: "배포된 맵을 다른 유저가 다운로드하면 **1회당 100칩이 지급**됩니다. (다운로더가 100칩을 지불하며 전액 제작자에게 이전 · 유저당 최초 1회 · 본인 다운로드 제외)"
- 이미 배포된 맵 → 버튼 라벨 "업데이트 배포" (재검증 필수, `published_at` 갱신).

### 5.4 기존 파일 변경

| 파일 | 변경 |
|---|---|
| `src/components/editor/EditorToolbar.tsx` | ① 저장/배포 버튼 렌더 조건 `userRole === 'admin'` → `['admin','premium'].includes(userRole)` (서버 배포 버튼은 admin 유지) ② `handleSave(meta?)` 리팩터 — 모달이 meta 전달, admin→`saveMapAction`, premium→`saveUserMapAction` ③ **premium의 기본맵 로드 = 사본**: 프리셋/공식맵 클릭 시 `loadMapPreset(key)` 후 `setMapId(null)` + 탭 제목 `[사본] {name}` + 미저장 표시 (기본맵 아코디언은 숨기지 않음 — 저장 경로가 `user_maps`라 원본 오염 불가, 서버에서도 프리셋 id 거부로 이중 방어) ④ premium 커스텀 아코디언: `mapDataCache` 필터 대신 `getMyUserMapsAction()` 결과로 "내 맵 (x/10)" 표시 |
| `src/components/editor/EditorContainer.tsx` | L104-134 레거시 EXPORT(무인증 `map_presets` INSERT + 6자리 코드 발급) **제거** — 배포 플로우가 대체 |
| `src/store/editorStore.ts` | `loadMapFromData(id, meta)` 액션 추가 — `mapDataCache`를 오염시키지 않고 개인 맵 데이터를 직접 주입 (`loadMapPreset`과 동일 로직, 소스만 다름) |

---

## 6. 맵 로드 모달 변경 — `src/components/MapLoadModal.tsx`

- 탭 라벨: `커스텀 맵 (코드 입력)` → **`커스텀 맵`**. 6자리 코드 입력 UI와 `map_presets` 조회 로직 제거.
- 탭 활성화 시 병렬 페치: `getMyDownloadsAction()` + (premium/admin이면) `getMyUserMapsAction()`.
- 두 섹션 구성:
  - **내가 만든 맵** (premium/admin 전용)
  - **다운로드한 맵** — 제작자명 · 다운로드 날짜 표시
- 항목 클릭 → 스냅샷을 기존 파이프라인에 그대로 주입: `setCustomMapData(snapshot.items)` + `setCustomMapMeta({worldHeight, wallStyle, bgImage, layoutConfig})` + `setCustomMapTitle(map_name)` → **기존 커스텀맵 플레이 경로(uiStore → PhysicsCanvas) 무변경으로 동작**.
- 우측 미리보기: 기존 `MapPreviewCanvas` 패턴 그대로 (스냅샷 items 전달).
- 비로그인: "로그인하면 상점에서 받은 커스텀 맵을 사용할 수 있습니다" + `/shop?view=mapstore` 이동 링크.

---

## 7. 상점 — 커스텀 맵 스토어 모드

### 7.1 뷰 모드 확장 — `src/app/shop/page.tsx`
- `viewMode: 'shop' | 'inventory'`(page.tsx:39) → `'shop' | 'inventory' | 'mapstore'` 3원화.
- 테마 분기(L316-317 패턴 확장): mapstore = **딥 그린 배경 `bg-[#04110A]` + emerald 액센트** (shop=amber `bg-neutral-950`, inventory=cyan `bg-[#050B14]`과 동일한 전체 테마 스왑, `transition-colors duration-700` 유지).
- `useSearchParams`로 `?view=mapstore` 딥링크 지원.
- **진입 버튼** (요구사항: '내 보관함' 왼쪽, 초록 박스): 상단 버튼 그룹(L324~)에서 보관함 토글 왼쪽에 배치 — `bg-emerald-900/40 border border-emerald-500/30 text-emerald-300` + `<Map size={16}/>` 아이콘 + "커스텀 맵 스토어". mapstore 모드에서는 복귀 동작으로 3-way 토글 처리.

### 7.2 신규 `src/components/shop/MapStorePanel.tsx`
mapstore 모드일 때 기존 좌우 12컬럼 그리드를 대체. **보관함보다 "더 고급지고 화려하게"**:

**좌측 쇼케이스 (lg:col-span-5)**
- 선택된 맵의 대형 `MapPreviewCanvas`를 **에메랄드 그라디언트 보더** 래퍼(`p-[1.5px] bg-gradient-to-br from-emerald-300 via-green-500 to-teal-600`) + 유리질(backdrop-blur) 카드 + 은은한 conic-gradient 회전 글로우.
- 맵 이름(emerald gradient clip-text), 제작자명, 설명, 길이/복잡도 배지(MapLoadModal 배지 색 체계 재사용), ⬇ 다운로드 수 · ♥ 좋아요 수.
- **대형 다운로드 버튼** `bg-gradient-to-r from-emerald-400 to-green-600` — 라벨 "100 칩 다운로드", 이미 받은 맵이면 "보유 중" 비활성, 본인 맵이면 "내가 만든 맵". 버튼 아래 소형 안내: "다운로드한 맵은 영구 보관됩니다".

**우측 리스트 (lg:col-span-7)**
- 상단 툴바: 정렬 세그먼트(**인기순** `download_count DESC` / **최신순** `published_at DESC`) + 검색 인풋(이름/제작자, v1은 클라이언트 필터).
- **2열 카드 그리드** (기존 1열 리스트보다 화려하게): 카드마다 미니 `MapPreviewCanvas` 썸네일, 이름, 제작자, 길이/복잡도 미니 배지, ⬇ 카운트 + ♥ 토글(`toggleMapLikeAction`), hover 시 emerald ring + scale + shine sweep 애니메이션. 인기 1위 맵에 "🏆 인기 1위" 리본.
- **칩 정책 상시 인포 라인(요구사항 필수)**: 리스트 헤더에 Info 아이콘 + emerald 톤으로 — **"맵 다운로드 100칩 · 지불한 칩은 제작자에게 전액 지급됩니다"**. 쇼케이스 다운로드 버튼 옆 툴팁에도 동일 문구.

**다운로드 플로우**
- 비로그인 → toast "로그인이 필요합니다".
- 잔액 100칩 미만 → 버튼 비활성 or toast "칩이 부족합니다" (상점 구매 플로우의 잔액 체크 패턴 재사용).
- 로그인 + 잔액 충분 → `downloadUserMapAction(mapId)` → 성공 시 로컬 칩 잔액 -100 반영(`deductChipsLocally` 패턴) + toast: "『{이름}』 저장 완료! (-100칩) 맵 로드 창의 커스텀 맵 탭에서 사용할 수 있어요."
- 재다운로드는 멱등(RPC의 ON CONFLICT) — 추가 과금 없이 "이미 보유 중" 처리.
- 데이터: 마운트 시 `getStoreMapsAction({sort})` + `getMyDownloadsAction()`(보유 표시). v1은 limit 60 단일 페이지, "더보기"는 후속.
- 애니메이션 구현 시 motion-design 가이드(이징/타이밍) 적용 권장.

---

## 8. 구현 로드맵

| Phase | 작업 | 파일 |
|---|---|---|
| **1. DB** | 마이그레이션 작성·적용, SQL 콘솔로 트리거/RPC 스모크 테스트 | `supabase/migrations/015_map_store.sql` (신규) |
| **2. 백엔드** | 엔티티 → 리포지토리 → UseCase 7종 → 서버 액션 | `src/core/entities/UserMap.ts`, `src/infrastructure/supabase/userMapRepository.ts`, `src/application/useCases/userMap/*.ts`, `src/presentation/actions/userMapActions.ts` (모두 신규), `SaveMapUseCase.ts` (주석만) |
| **3. 에디터** | 라우트 게이팅, 저장/배포 모달, 툴바 역할 분기, EXPORT 제거 | `src/app/editor/page.tsx`, `src/app/editor/EditorPageClient.tsx` (신규), `src/components/editor/SaveMapModal.tsx` (신규), `PublishMapModal.tsx` (신규), `EditorToolbar.tsx`, `EditorContainer.tsx`, `src/store/editorStore.ts` |
| **4. 맵 로드** | 코드입력 탭 → 커스텀 맵 탭 교체 | `src/components/MapLoadModal.tsx` |
| **5. 스토어 UI** | viewMode 3원화 + 그린 테마 + 스토어 패널 | `src/app/shop/page.tsx`, `src/components/shop/MapStorePanel.tsx` (신규) |
| **6. 검증** | §10 시나리오 전체 수행 | — |

---

## 9. 리스크 / 엣지 케이스

| 케이스 | 대응 |
|---|---|
| 맵 이름 충돌 | 전역 유니크 제약 없음(의도) — 스토어 카드에 제작자명 병기로 구분 |
| 제작자 탈퇴/삭제 | `owner_id CASCADE`로 본인 맵·스토어 노출 소멸. 다운로더는 스냅샷(`source_map_id SET NULL` + 비정규화 이름/제작자명)으로 계속 플레이 가능 |
| premium 강등 | 기존 맵 보존·수정·삭제 가능. RLS의 INSERT role 체크로 **신규 저장만 차단**. 배포 맵은 배포 상태 유지 |
| 배포 맵 재편집 | 단일 행 모델 → 저장 시 스토어 즉시 반영 (SaveMapModal에 경고 문구). 기존 다운로더는 스냅샷이라 무영향. 재배포는 재검증 필수 |
| 칩 파밍 (다계정) | 다운로드가 100칩 유료화되면서 파밍 유인 대폭 감소(칩 이전이라 시스템 총량 불변). 최초 1회 + 셀프 제외 가드 유지 |
| 다운로더 잔액 부족 | RPC 내 차감 실패 시 **전체 롤백**(스냅샷·카운트·보상 모두 미발생). 클라이언트는 사전 잔액 체크로 UX 방어 |
| 검증 결과 조작 | 클라이언트 제출 기반이라 가능 — 피해는 "저품질 맵 노출" 수준. 서버 재시뮬은 후속 과제(주석 명시) |
| 맵 JSON 스키마 진화 | `schema_version=1` 저장 + 스냅샷 포함 → 로드 측 마이그레이션 훅 지점 확보 |
| `mapDataCache` 오염 | 개인 맵은 캐시 미주입, `loadMapFromData`로 직접 로드 — `GetMapsUseCase` 머지 로직 불변식 유지 |
| Next 15 서버 컴포넌트 | `dynamic({ssr:false})` 불가 → EditorPageClient 분리. `redirect()`는 `next/navigation` |

---

## 10. 검증 시나리오 (QA 체크리스트)

- [ ] 타입/빌드: `npx tsc --noEmit`, `npm run build` 통과
- [ ] **(a)** user 계정으로 `/editor` 접근 → `/dashboard` redirect
- [ ] **(b)** premium 저장: 모달(이름/설명/길이/복잡도) → `user_maps` insert. 11번째 저장 시 슬롯 에러 메시지
- [ ] **(c)** premium이 기본맵 로드 → `[사본]` 탭 → 저장해도 `maps` 테이블·원본 무변경
- [ ] **(d)** 검증 실패 맵 배포 시도 → 거부 + 미통과 체크 표시 / 통과 맵 → 스토어 노출
- [ ] **(e)** 타 계정 다운로드 → 다운로더 칩 -100(`map_download_*`) + `user_map_downloads` 스냅샷 생성 + `download_count` +1 + 제작자 칩 +100(`map_download_reward_*`) / **재다운로드·셀프 다운로드 → 과금·보상 없음** / **잔액 부족 → 전체 롤백(스냅샷 미생성)**
- [ ] **(f)** MapLoadModal 커스텀 맵 탭에서 받은 맵 선택 → 레이스 정상 시작
- [ ] **(g)** 제작자가 배포 맵 삭제 → 다운로더는 계속 플레이 가능
- [ ] **(h)** admin 기존 저장/서버 배포 플로우 회귀 없음
- [ ] **(i)** 100칩 정책 문구가 배포 모달·스토어 헤더 양쪽에 노출

---

## 11. v2 확정 백로그 (본 PRD 구현 완료 후 — 별도 PRD는 사용자 요청 시 작성)

사용자가 반영하기로 확정한 후속 항목. **본 PRD 범위에 포함하지 않으며**, 현재 구현이 끝난 뒤 요청 시 별도 PRD로 구체화한다.

1. **커스텀 맵 전용 리더보드** — 스토어 맵별 플레이 횟수/베스트 기록 (results 테이블 연동).
2. **admin 관리 페이지에 배포맵 관리 탭** — 배포맵 목록·숨김·삭제 (기존 `admin/actions/mapActions.ts` 패턴).
3. **제작자 업적 생성** — 누적 다운로드/배포 마일스톤 업적 (achievement 타입만, **일간·주간 미션은 제외**).
4. **주간 인기맵 / 월간 인기맵** — 기간별 다운로드 집계 랭킹 + Featured 노출.
5. **슬롯 확장권 구입** — 10슬롯을 칩으로 확장 구매 (예: 1000칩/+5슬롯).

---

## 부록 — 재사용 자산 맵

| 자산 | 위치 | 용도 |
|---|---|---|
| `profiles.role` CHECK('user','premium','admin') | `supabase/migrations/000` | 스키마 변경 불필요 — 그대로 사용 |
| `add_chips` / `deduct_chips` RPC + `chip_logs` | `supabase/migrations/006` | 다운로드 보상 지급 |
| `runValidationAsync` + `ValidationResult` | `src/lib/editor/validationClient.ts:8`, `validationTypes.ts:9` | 배포 전 검증 게이트 |
| `ValidationPanel` 진행률 UI 패턴 | `src/components/editor/ValidationPanel.tsx` | PublishMapModal 검증 단계 |
| `MapPreviewCanvas` | MapLoadModal에서 사용 중 | 스토어 쇼케이스/카드 썸네일 |
| viewMode 테마 스왑 패턴 | `src/app/shop/page.tsx:39,316-317` | mapstore 그린 테마 |
| `MapPresetMeta.lengthType/complexity` enum | `src/engine/MapPresets.ts:25-42` | 저장 모달 드롭다운·DB CHECK 값 |
| admin 서버 게이팅 패턴 | `src/app/admin/layout.tsx:15-32` | `/editor` 라우트 게이팅 |
| `mapRepository.ts` 리포지토리 패턴 | `src/infrastructure/supabase/mapRepository.ts` | userMapRepository 골격 |
| `mapActions.ts` 서버 액션 패턴 | `src/presentation/actions/mapActions.ts` | userMapActions 골격 |
