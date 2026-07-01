'use client'

import React, { useEffect, useRef } from 'react'
import type { EditorItem } from '@/store/editorStore'
import { itemRotationDeg } from '@/lib/render/rotation'

interface MapPreviewCanvasProps {
  mapData: EditorItem[]
  worldHeight: number
  className?: string
}

const WORLD_WIDTH = 800
const MAX_CANVAS_HEIGHT = 400

export default function MapPreviewCanvas({ mapData, worldHeight, className = '' }: MapPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Calculate scaling to fit within MAX_CANVAS_HEIGHT while preserving aspect ratio
    // If map is short, we still want to fit width if necessary, but usually worldHeight >> width.
    let scale = MAX_CANVAS_HEIGHT / Math.max(worldHeight, 800)
    
    // Set actual canvas size
    const canvasWidth = WORLD_WIDTH * scale
    const canvasHeight = worldHeight * scale

    // Handle high DPI displays for crisp rendering
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    
    // CSS size
    canvas.style.width = `${canvasWidth}px`
    canvas.style.height = `${canvasHeight}px`

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Scale according to DPR and calculated scale
    ctx.scale(dpr * scale, dpr * scale)

    // Helper function to draw items
    const drawItem = (item: EditorItem) => {
      ctx.save()
      ctx.translate(item.x, item.y)
      const rotDeg = itemRotationDeg(item)
      if (rotDeg) {
        ctx.rotate((rotDeg * Math.PI) / 180)
      }

      switch (item.type) {
        case 'wall':
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
          // walls are usually centered at x,y
          ctx.fillRect(-(item.w || 0) / 2, -(item.h || 0) / 2, item.w || 0, item.h || 0)
          break
        case 'bumper':
          ctx.fillStyle = '#FF5555'
          ctx.beginPath()
          ctx.arc(0, 0, item.radius || 10, 0, Math.PI * 2)
          ctx.fill()
          break
        case 'pin':
          ctx.fillStyle = '#AAAAAA'
          ctx.beginPath()
          ctx.arc(0, 0, item.radius || 5, 0, Math.PI * 2)
          ctx.fill()
          break
        case 'hole':
        case 'blackhole':
          ctx.fillStyle = '#AA00FF'
          ctx.beginPath()
          ctx.arc(0, 0, item.radius || 20, 0, Math.PI * 2)
          ctx.fill()
          break
        case 'whitehole':
          ctx.fillStyle = '#FFFFFF'
          ctx.beginPath()
          ctx.arc(0, 0, item.radius || 20, 0, Math.PI * 2)
          ctx.fill()
          break
        case 'portal':
          ctx.fillStyle = item.color || '#00FFFF'
          ctx.beginPath()
          ctx.arc(0, 0, item.radius || 20, 0, Math.PI * 2)
          ctx.fill()
          break
        case 'booster':
          ctx.fillStyle = '#FFFF00'
          ctx.fillRect(-(item.w || 40) / 2, -(item.h || 40) / 2, item.w || 40, item.h || 40)
          break
        case 'windmill':
          ctx.strokeStyle = '#00FFFF'
          ctx.lineWidth = 4 / scale // keep line width somewhat consistent
          ctx.beginPath()
          ctx.moveTo(- (item.radius || 40), 0)
          ctx.lineTo(item.radius || 40, 0)
          ctx.moveTo(0, - (item.radius || 40))
          ctx.lineTo(0, item.radius || 40)
          ctx.stroke()
          break
        case 'piston':
          ctx.fillStyle = '#FFAA00'
          ctx.fillRect(-(item.w || 40) / 2, -(item.h || 40) / 2, item.w || 40, item.h || 40)
          break
        case 'spinner':
          ctx.fillStyle = '#FF00FF'
          const sw = item.w || 200
          const sh = item.h || 20
          ctx.fillRect(-sw / 2, -sh / 2, sw, sh)
          break
        default:
          break
      }
      ctx.restore()
    }

    // Draw background grid lines for visual reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1 / scale
    for (let y = 0; y < worldHeight; y += 200) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(WORLD_WIDTH, y)
      ctx.stroke()
    }

    // Draw all items
    mapData.forEach(drawItem)

    // Draw finish line at bottom
    ctx.fillStyle = '#00FF00'
    ctx.globalAlpha = 0.3
    ctx.fillRect(0, worldHeight - 50, WORLD_WIDTH, 50)
    ctx.globalAlpha = 1.0
  }, [mapData, worldHeight])

  return (
    <div className={`flex justify-center items-center overflow-hidden bg-black/40 rounded-xl border border-white/5 py-4 ${className}`}>
      <canvas ref={canvasRef} className="block shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-[#111]" />
    </div>
  )
}
