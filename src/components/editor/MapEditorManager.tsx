'use client'

import React from 'react'
import EditorCanvas from './EditorCanvas'
import ToolboxPanel from './ToolboxPanel'
import InspectorPanel from './InspectorPanel'

export default function MapEditorManager() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white">
      {/* 1. 순수 PIXI.js 에디터 캔버스 */}
      <EditorCanvas />

      {/* 2. 좌측 툴박스 패널 */}
      <ToolboxPanel />

      {/* 3. 우측 인스펙터 패널 */}
      <InspectorPanel />
    </div>
  )
}
