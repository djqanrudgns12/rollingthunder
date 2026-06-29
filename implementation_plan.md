# 맵 에디터 심화 구현 계획 (Advanced PRD)

실제 게임 환경(`PhysicsCanvas`)과 100% 동일한 비주얼, 실시간 미니맵, 그리고 `MapPresets.ts`에 정의된 실제 맵 데이터(네온 아케이드, 운석 지대 등)를 불러와 수정할 수 있도록 에디터를 고도화합니다.

## ⚠️ User Review Required

- **에셋 의존성**: 실제 게임에 쓰이는 텍스처(`/images/assets/obstacles/...`)를 맵 에디터의 툴박스와 캔버스에 직접 렌더링합니다. 이 과정에서 브라우저의 캐시나 애셋 로딩 딜레이가 발생할 수 있는데, 로딩 화면(Loading Spinner)을 맵 에디터 진입 시 추가하는 것에 동의하시나요?
- **미니맵 렌더링 방식**: PIXI.js의 RenderTexture를 이용하면 성능 소모가 있을 수 있어, **React 기반의 실시간 SVG 미니맵**을 에디터 우측 하단(또는 좌측)에 띄우는 방식을 제안합니다. 실제 기물의 축소판 아이콘과 위치를 그대로 동기화합니다.

## Open Questions

- "기본맵을 구현해달라했더니 기본맵이라 구현했네? 네온 아케이드부터 운석지대까지 다 구현해야지." 
  👉 `MapPresets.ts`의 모든 맵을 `EditorToolbar`의 드롭다운에서 선택 가능하게 만들고, 선택 시 해당 맵의 배경 이미지(`bgImage`)와 외벽(`wallStyle`), 기물 리스트(`items`)를 즉시 불러오도록(Load) 구현하면 될까요?

## Proposed Changes

### 1. `src/store/editorStore.ts`
- **[MODIFY]**: `loadMapPreset(mapId: string)` 함수 추가. 
- 선택된 맵의 배경 이미지 경로, 맵 높이(`worldHeight`), `layoutConfig`, 그리고 `items` 배열을 상태로 가져오도록 확장.

### 2. `src/components/editor/EditorToolbar.tsx`
- **[MODIFY]**: 기존 하드코딩된 '기본 맵 1', '기본 맵 2' 드롭다운을 제거.
- `src/engine/MapPresets.ts`의 `MapPresets` 객체를 순회하여 실제 맵 리스트("네온 아케이드", "운석 지대" 등)를 렌더링.
- 맵 선택 시 `editorStore.loadMapPreset` 호출.

### 3. `src/components/editor/ToolboxPanel.tsx`
- **[MODIFY]**: Lucide 아이콘(Lucide-react)을 제거.
- 실제 에셋 이미지 (`/images/assets/obstacles/obstacle_${type}.png` 등)를 `<img />` 태그로 렌더링.
- 각 기물이 실제 게임에서 어떻게 생겼는지 파악할 수 있도록 썸네일 크기 확대 및 스타일링 수정.

### 4. `src/components/editor/EditorCanvas.tsx`
- **[MODIFY]**: `PIXI.Graphics`로 단순 도형을 그리던 로직을 `PIXI.Sprite` 기반으로 전면 교체.
- `PIXI.Assets.load`를 통해 에디터 마운트 시 필요한 장애물 텍스처와 배경 이미지를 미리 로딩.
- 드래그 중이거나 배치된 기물이 **실제 게임의 모습**과 동일한 비율과 텍스처로 보이도록 구현.
- 게임과 동일한 배경 렌더링 (예: `TilingSprite`를 이용한 성운/우주 배경 출력).

### 5. `src/components/editor/MinimapOverlay.tsx`
- **[NEW]**: 새로운 미니맵 컴포넌트 추가.
- `EditorCanvas.tsx` 위에 겹쳐지는 형태로, 전체 `worldHeight` 대비 현재 뷰포트가 보고 있는 영역(카메라 위치)을 사각형으로 표시.
- 맵에 배치된 기물들의 좌표를 스케일 다운하여 실시간 점/아이콘으로 표시.

## Verification Plan

### Automated Tests
- `npm run dev` 후 타입 검사(`tsc --noEmit`) 오류 제로 확인.

### Manual Verification
- 맵 에디터에 접속 시 "네온 아케이드" 등 실제 프리셋 맵이 로딩되는지 확인.
- 툴박스에 실제 스프라이트 이미지가 표시되는지 확인.
- 캔버스 내 기물이 단순한 도형이 아니라 실제 게임 텍스처를 입고 있는지 확인.
- 우측/좌측 하단의 미니맵에 전체 맵 형태와 현재 카메라 영역이 실시간으로 연동되는지 확인.
