'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import dynamic from 'next/dynamic'

const EditorContainer = dynamic(() => import('@/components/editor/EditorContainer'), { ssr: false })

export default function EditorPage() {
  return (
    <main className="flex-1 w-full h-[100dvh] overflow-hidden bg-[var(--bg-primary)] flex flex-col pt-16 relative">
      <Link href="/" className="absolute top-6 left-6 text-white/50 hover:text-white transition-colors flex items-center gap-2 z-50">
        <ArrowLeft className="w-5 h-5" /> 메인으로
      </Link>
      
      <EditorContainer />
    </main>
  )
}
