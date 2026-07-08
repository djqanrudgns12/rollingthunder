/**
 * 맵 검증 Web Worker 엔트리.
 * physics.worker.ts 패턴: 워커 내부에서 SimulationCore(Rapier WASM)를 로드해 헤드리스 검증 루프를 돌린다.
 * 메인 → 워커: RUN(검증 설정) / CANCEL(소프트 취소)
 * 워커 → 메인: PROGRESS / RESULT / ERROR
 */
import { runValidationLoop } from './validationRunner'
import type { ValidationHostMsg, ValidationWorkerMsg } from './validationTypes'

let cancelled = false

const post = (msg: ValidationWorkerMsg) => (self as any).postMessage(msg)

self.onmessage = async (e: MessageEvent<ValidationHostMsg>) => {
  const data = e.data
  if (data.type === 'CANCEL') { cancelled = true; return }
  if (data.type !== 'RUN') return

  cancelled = false
  try {
    const result = await runValidationLoop(data.payload.config, {
      onProgress: (race, races) => post({ type: 'PROGRESS', payload: { race, races, pct: races ? race / races : 0 } }),
      shouldAbort: () => cancelled,
    })
    if (!cancelled) post({ type: 'RESULT', payload: result })
  } catch (err: any) {
    post({ type: 'ERROR', payload: { message: err?.message ?? String(err) } })
  }
}
