'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { runValidationAsync } from '@/lib/editor/validationClient'
import { METRIC_INFO, type ValidationResult } from '@/lib/editor/validationTypes'
import { launchTestPlay } from '@/lib/editor/testPlay'
import { FlaskConical, X, Loader2, Info, Play, ChevronDown, ChevronRight } from 'lucide-react'

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
  const [progressRace, setProgressRace] = useState<[number, number]>([0, 0])
  const [races, setRaces] = useState(8)
  const chips = useEditorStore(s => s.previewChipCount)
  const setChips = useEditorStore(s => s.setPreviewChipCount)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [comebackStrength, setComebackStrength] = useState(50)
  const [playTime, setPlayTime] = useState(50)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const run = async () => {
    const st = useEditorStore.getState()
    const items = st.items.filter(it => it.type !== 'startline' && it.type !== 'endline')
    if (items.length === 0) { alert('배치된 기물이 없습니다.'); return }
    const ac = new AbortController()
    abortRef.current = ac
    setRunning(true); setProgress(0); setProgressRace([0, races]); setResult(null)
    try {
      const res = await runValidationAsync(
        { items: st.items, worldHeight: st.worldHeight, wallStyle: st.wallStyle, layoutConfig: st.layoutConfig, races, chips, comebackStrength, playTime },
        {
          signal: ac.signal,
          onProgress: (pct, race, total) => { setProgress(pct); setProgressRace([race, total]) },
        }
      )
      setResult(res)
    } catch (e: any) {
      if (e?.name === 'AbortError') { /* 사용자 취소 — 조용히 무시 */ }
      else { console.error(e); alert('검증 실행 중 오류: ' + (e?.message || e)) }
    } finally { setRunning(false); abortRef.current = null }
  }

  const cancel = () => { abortRef.current?.abort() }

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

  const passCount = result ? result.checks.filter(c => c.ok).length : 0
  const allPass = result ? passCount === result.checks.length : false

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

      <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#444]">
        {/* 설정부 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <label className="flex flex-col gap-0.5 flex-1" title="같은 맵을 몇 번 반복 실행해 통계를 낼지. 많을수록 정확하지만 오래 걸립니다 (권장 8~16).">
              <span className="text-[10px] text-gray-400">시뮬레이션 횟수</span>
              <input type="number" min={1} max={40} value={races} onChange={e => setRaces(Math.max(1, Math.min(40, parseInt(e.target.value) || 1)))}
                className="w-full bg-[#252525] border border-[#444] rounded px-2 py-1 font-mono" />
            </label>
            <label className="flex flex-col gap-0.5 flex-1" title="레이스에 참가하는 마블 수. 실제 진행할 인원과 맞추세요. 스폰 프리뷰·테스트 플레이와 연동됩니다.">
              <span className="text-[10px] text-gray-400">참가 칩 수</span>
              <input type="number" min={2} max={20} value={chips} onChange={e => setChips(parseInt(e.target.value) || 2)}
                className="w-full bg-[#252525] border border-[#444] rounded px-2 py-1 font-mono" />
            </label>
          </div>

          {/* 고급 설정 */}
          <button onClick={() => setShowAdvanced(v => !v)} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300">
            {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} 고급 설정 (엔진 페이싱)
          </button>
          {showAdvanced && (
            <div className="space-y-2 pl-1 border-l border-[#333]">
              <label className="block text-[10px] text-gray-400" title="선두와의 격차를 좁히는 역전 보정 강도 (0=비활성, 50=기본).">
                역전 다이내믹스 <span className="font-mono text-gray-300">{comebackStrength}</span>
                <input type="range" min={0} max={100} value={comebackStrength} onChange={e => setComebackStrength(parseInt(e.target.value))} className="w-full accent-[#00ffcc]" />
              </label>
              <label className="block text-[10px] text-gray-400" title="우승 확정 후 마무리 페이싱 (50=중립, 낮으면 압축, 높으면 느긋).">
                플레이 시간 페이싱 <span className="font-mono text-gray-300">{playTime}</span>
                <input type="range" min={0} max={100} value={playTime} onChange={e => setPlayTime(parseInt(e.target.value))} className="w-full accent-[#00ffcc]" />
              </label>
            </div>
          )}

          {/* 실행 / 취소 */}
          {!running ? (
            <button onClick={run}
              className="w-full flex items-center justify-center gap-1 bg-[#00ffcc] text-black px-3 py-1.5 rounded font-bold hover:bg-[#00e6b8]">
              검증 실행
            </button>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[#252525] rounded overflow-hidden">
                  <div className="h-full bg-[#00ffcc] transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <button onClick={cancel} className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-0.5 border border-red-400/40 rounded">취소</button>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" /> 레이스 {progressRace[0]}/{progressRace[1]} · {Math.round(progress * 100)}%
              </div>
            </div>
          )}
        </div>

        {result && (
          <>
            {/* 종합 배지 */}
            <div className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-bold ${allPass ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
              <span>{allPass ? '✓ 레이스 준비 완료' : '⚠ 개선 권장'}</span>
              <span className="font-mono">{passCount}/{result.checks.length} 통과</span>
            </div>

            <div className="space-y-1">
              {result.checks.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs group">
                  <span className="text-gray-400 flex items-center gap-1">
                    {c.label}
                    {METRIC_INFO[c.label] && (
                      <span className="relative">
                        <Info className="w-3 h-3 text-gray-600 group-hover:text-gray-400 cursor-help peer" />
                        <span className="pointer-events-none absolute left-4 bottom-0 z-50 hidden peer-hover:block w-52 p-2 rounded bg-[#0a0a10] border border-[#444] text-[10px] leading-snug text-gray-300 shadow-xl">
                          {METRIC_INFO[c.label].tooltip}
                        </span>
                      </span>
                    )}
                  </span>
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
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">칩 이동 히트맵</span>
                {result.stuckSamples.length > 0 && (
                  <span className="text-[10px] text-red-400 font-mono">미완주 지점 {result.stuckSamples.length}개</span>
                )}
              </div>
              <div className="flex justify-center bg-[#0a0a10] rounded p-1 border border-[#333]">
                <canvas ref={canvasRef} className="rounded" style={{ width: 120, height: 120 * (result.heatmap.rows / result.heatmap.cols), imageRendering: 'auto' }} />
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-1 text-[9px] text-gray-500">
                <span>통행 적음</span>
                <span className="inline-block h-2 w-16 rounded" style={{ background: 'linear-gradient(90deg,#0078ff,#00ffcc,#ffff00,#ff0000)' }} />
                <span>밀집/정체</span>
              </div>
            </div>
          </>
        )}

        {!result && !running && (
          <p className="text-[11px] text-gray-500 text-center py-1">현재 맵을 여러 번 시뮬레이션하여 완주시간·공정성·정체·기믹 적중률을 점검하고, 칩 이동 히트맵으로 병목을 찾습니다.</p>
        )}

        {/* 테스트 플레이 */}
        <button onClick={() => launchTestPlay(chips)} disabled={running}
          className="w-full flex items-center justify-center gap-1.5 bg-[#252525] border border-[#00ffcc]/30 text-[#00ffcc] px-3 py-1.5 rounded font-bold text-xs hover:bg-[#2a2a2a] disabled:opacity-40">
          <Play className="w-3.5 h-3.5" /> 테스트 플레이 ({chips}칩)
        </button>
      </div>
    </div>
  )
}
