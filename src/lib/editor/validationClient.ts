/**
 * 맵 검증 워커 클라이언트 — UI가 쓰는 유일한 API.
 * 워커 생성/진행률/취소를 캡슐화한다. 실행당 워커를 생성/종료(누수 없음).
 * 취소 2단계: signal.abort → CANCEL 메시지(다음 레이스 경계에서 소프트 중단) 후 terminate(하드).
 */
import type { ValidationConfig, ValidationResult, ValidationWorkerMsg } from './validationTypes'

export function runValidationAsync(
  config: ValidationConfig,
  opts: { onProgress?: (pct: number, race: number, races: number) => void; signal?: AbortSignal } = {}
): Promise<ValidationResult> {
  return new Promise((resolve, reject) => {
    // PhysicsCanvas 와 동일한 Turbopack 검증 패턴
    const worker = new Worker(new URL('./validation.worker.ts', import.meta.url))
    let settled = false

    const cleanup = () => {
      opts.signal?.removeEventListener('abort', onAbort)
      worker.terminate()
    }
    const onAbort = () => {
      // 소프트 취소 신호 후 즉시 종료(한 레이스가 오래 걸려도 즉시 정지)
      try { worker.postMessage({ type: 'CANCEL' }) } catch {}
      if (!settled) { settled = true; cleanup(); reject(new DOMException('Aborted', 'AbortError')) }
    }

    if (opts.signal) {
      if (opts.signal.aborted) { worker.terminate(); reject(new DOMException('Aborted', 'AbortError')); return }
      opts.signal.addEventListener('abort', onAbort)
    }

    worker.onmessage = (e: MessageEvent<ValidationWorkerMsg>) => {
      const msg = e.data
      if (msg.type === 'PROGRESS') { opts.onProgress?.(msg.payload.pct, msg.payload.race, msg.payload.races); return }
      if (settled) return
      settled = true
      cleanup()
      if (msg.type === 'RESULT') resolve(msg.payload)
      else if (msg.type === 'ERROR') reject(new Error(msg.payload.message))
    }
    worker.onerror = (e) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(e.message || '검증 워커 오류'))
    }

    worker.postMessage({ type: 'RUN', payload: { config } })
  })
}
