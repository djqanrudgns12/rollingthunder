'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { runValidation, ValidationResult } from '@/lib/editor/mapValidator'
import { FlaskConical, X, Loader2 } from 'lucide-react'

// 밀도 → 색 (파랑→청록→노랑→빨강)
function heatColor(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t))
  if (t < 0.25) return [0, Math.round(120 + t * 4 * 135), 255]
  if (t < 0.5) return [0, 255, Math.round(255 - (t - 0.25) * 4 * 255)]
  if (t < 0.75) return [Math.round((t - 0.5) * 4 * 255), 255, 0]
  return [255, Math.round(255 - (t - 0.75) * 4 * 255), 0]
}

export default function ValidationPanel() {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [races, setRaces] = useState(8)
  const [chips, setChips] = useState(10)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const run = async () => {
    const st = useEditorStore.getState()
    const items = st.items.filter(it => it.type !== 'startline' && it.type !== 'endline')
    if (items.length === 0) { alert('배치된 기물이 없습니다.'); return }
    setRunning(true); setProgress(0); setResult(null)
    try {
      const res = await runValidation(
        { items: st.items, worldHeight: st.worldHeight, wallStyle: st.wallStyle, layoutConfig: st.layoutConfig, races, chips },
        (p) => setProgress(p)
      )
      setResult(res)
    } catch (e: any) {
      console.error(e); alert('검증 실행 중 오류: ' + (e?.message || e))
    } finally { setRunning(false) }
  }

  // 히트맵 렌더
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !result) return
    const { cols, rows, grid, max } = result.heatmap
    cv.width = cols; cv.height = rows
    const ctx = cv.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, cols, rows)
    if (max <= 0) return
    const img = ctx.createImageData(cols, rows)
    for (let i = 0; i < grid.length; i++) {
      const t = grid[i] / max
      const [r, g, b] = heatColor(t)
      const o = i * 4
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b
      img.data[o + 3] = grid[i] > 0 ? Math.round(60 + t * 195) : 0
    }
    ctx.putImageData(img, 0, 0)
  }, [result])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-6 right-6 z-30 flex items-center gap-2 bg-[#1a1a1a]/95 border border-[#00ffcc]/40 text-[#00ffcc] px-4 py-2 rounded-full text-sm font-bold shadow-lg hover:bg-[#222] pointer-events-auto"
        title="현재 맵을 헤드리스 시뮬레이션으로 검증"
      >
        <FlaskConical className="w-4 h-4" /> 맵 검증
      </button>
    )
  }

  return (
    <div className="absolute bottom-6 right-6 z-30 w-80 bg-[#141419] border border-[#333] rounded-xl shadow-2xl pointer-events-auto overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-[#333] bg-[#1c1c22]">
        <h3 className="text-sm font-bold text-[#00ffcc] flex items-center gap-2"><FlaskConical className="w-4 h-4" /> 맵 검증</h3>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <label className="flex items-center gap-1">레이스
            <input type="number" min={1} max={40} value={races} onChange={e => setRaces(Math.max(1, Math.min(40, parseInt(e.target.value) || 1)))}
              className="w-12 bg-[#252525] border border-[#444] rounded px-1 py-0.5 font-mono" />
          </label>
          <label className="flex items-center gap-1">칩
            <input type="number" min={2} max={20} value={chips} onChange={e => setChips(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
              className="w-12 bg-[#252525] border border-[#444] rounded px-1 py-0.5 font-mono" />
          </label>
          <button onClick={run} disabled={running}
            className="ml-auto flex items-center gap-1 bg-[#00ffcc] disabled:opacity-40 text-black px-3 py-1 rounded font-bold hover:bg-[#00e6b8]">
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {running ? `${Math.round(progress * 100)}%` : '실행'}
          </button>
        </div>

        {result && (
          <>
            <div className="space-y-1">
              {result.checks.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{c.label}</span>
                  <span className={`font-mono ${c.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {c.ok ? '✓' : '✗'} {c.value} <span className="text-gray-600">({c.target})</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              완주 p10 {result.p10.toFixed(1)}s ~ p90 {result.p90.toFixed(1)}s · 평균속도 {Number.isFinite(result.avgSpeed) ? result.avgSpeed.toFixed(0) : '-'}px/s
            </div>

            <div>
              <div className="text-[10px] text-gray-500 mb-1">칩 이동 히트맵 (빨강=병목/정체)</div>
              <div className="flex justify-center bg-[#0a0a10] rounded p-1 border border-[#333]">
                <canvas ref={canvasRef} className="rounded" style={{ width: 120, height: 120 * (result.heatmap.rows / result.heatmap.cols), imageRendering: 'auto' }} />
              </div>
            </div>
          </>
        )}

        {!result && !running && (
          <p className="text-[11px] text-gray-500 text-center py-2">현재 맵을 여러 번 시뮬레이션하여 완주시간·공정성·정체·기믹 적중률을 점검하고, 칩 이동 히트맵으로 병목을 찾습니다.</p>
        )}
      </div>
    </div>
  )
}
