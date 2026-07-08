/**
 * 칩 스폰 슬롯 생성 (순수 함수) — 물리(SimulationCore)와 에디터 스폰 프리뷰가 동일 소스를 공유한다.
 * SimulationCore.generateSlots 본문을 추출한 것으로 동작은 동일하다(오차 0).
 * PRD-map-validation §5 참조.
 */
export interface SpawnSlot { x: number; y: number }

/**
 * @param count      칩 수
 * @param width      월드 가로폭(px)
 * @param layoutConfig  { startLineY?, startMarginPercent?, spawnGap? }
 * @param worldHeight   월드 세로 길이(px)
 * @param rng        0~1 난수(셔플용). 미지정 시 Math.random — 프리뷰는 셔플 결과가 시각에 무관하므로 기본값 사용 가능.
 */
export function generateSpawnSlots(
  count: number,
  width: number,
  layoutConfig?: any,
  worldHeight: number = 3300,
  rng: () => number = Math.random,
): SpawnSlot[] {
  const slots: SpawnSlot[] = []
  let spacingX = 85  // 기본 가로 간격
  let rowSpacingY = 75 // 기본 세로 간격
  const availableWidth = width * 0.92

  const startLineY = layoutConfig?.startLineY ??
                     (layoutConfig?.startMarginPercent ? worldHeight * layoutConfig.startMarginPercent : 70)
  const spawnGap = layoutConfig?.spawnGap ?? 50

  // PRD v6.0 Auto-Scale 로직
  const MIN_SPACING_X = 55
  const MIN_SPACING_Y = 65
  const topLimit = -400 // 카메라가 닿는 확장된 천장
  const availableHeight = startLineY - spawnGap - topLimit

  // 단계적 압축 로직
  let maxPerRow = Math.max(1, Math.floor(availableWidth / spacingX))
  let rows = Math.ceil(count / maxPerRow)
  let requiredHeight = (rows - 1) * rowSpacingY

  // 가로 압축 (Step 1)
  while (requiredHeight > availableHeight && spacingX > MIN_SPACING_X) {
    spacingX = Math.max(MIN_SPACING_X, spacingX - 5)
    maxPerRow = Math.max(1, Math.floor(availableWidth / spacingX))
    rows = Math.ceil(count / maxPerRow)
    requiredHeight = (rows - 1) * rowSpacingY
  }

  // 세로 압축 (Step 2)
  while (requiredHeight > availableHeight && rowSpacingY > MIN_SPACING_Y) {
    rowSpacingY = Math.max(MIN_SPACING_Y, rowSpacingY - 5)
    requiredHeight = (rows - 1) * rowSpacingY
  }

  let slotIdx = 0

  for (let r = 0; r < rows; r++) {
    // PRD v6.0: 강제 클램핑 해제 (공간이 없으면 topLimit 위쪽으로 오버플로우 허용)
    const rowY = startLineY - spawnGap - (rows - 1 - r) * rowSpacingY
    const countInRow = (r === rows - 1) ? (count - slotIdx) : maxPerRow

    // 줄의 실제 너비 계산 후 중앙 정렬
    const rowWidth = (countInRow - 1) * spacingX
    const rowStartX = (width - rowWidth) / 2

    for (let c = 0; c < countInRow; c++) {
      slots.push({ x: rowStartX + c * spacingX, y: rowY })
      slotIdx++
    }
  }

  // Fisher-Yates 셔플
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }

  return slots
}
