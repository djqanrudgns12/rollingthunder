/**
 * 인-에디터 테스트 플레이 런처.
 * editorStore 의 현재 맵을 스냅샷으로 떠서 uiStore.testPlaySession 에 실어 gameStage='playing' 으로 전환한다.
 * 실제 게임 경로(physics.worker + PhysicsCanvas)를 그대로 태우므로 물리·기믹·스킬·렌더가 100% 동일.
 * customMapData(persist) 브리지를 재사용하지 않아 localStorage 오염이 없다.
 */
import { useEditorStore } from '@/store/editorStore'
import { useUIStore } from '@/store/uiStore'

/** 더미 참가자 색상 — HSL 색상환을 균등 분할. */
function wheelColor(i: number, n: number): string {
  const h = Math.round((360 * i) / Math.max(1, n))
  return `hsl(${h}, 75%, 55%)`
}

export function launchTestPlay(chipCount?: number) {
  const st = useEditorStore.getState()
  const playable = st.items.filter(it => it.type !== 'startline' && it.type !== 'endline')
  if (playable.length === 0) {
    alert('배치된 기물이 없습니다. 기물을 배치한 뒤 테스트하세요.')
    return
  }

  const n = Math.max(2, Math.min(20, chipCount ?? st.previewChipCount ?? 10))
  const survivors = Array.from({ length: n }, (_, i) => ({
    id: `test_${i}`,
    name: `T${i + 1}`,
    color: wheelColor(i, n),
  }))

  useUIStore.getState().startTestPlay({
    // items 원본 그대로(startline/endline 포함) — 얕은 복사로 이후 편집과 격리
    items: [...st.items],
    meta: {
      worldHeight: st.worldHeight,
      wallStyle: st.wallStyle,
      bgImage: st.bgImage,
      layoutConfig: st.layoutConfig,
    },
    survivors,
  })
}
