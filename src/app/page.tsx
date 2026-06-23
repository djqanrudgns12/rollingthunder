'use client'

import dynamic from 'next/dynamic'

const GameManager = dynamic(() => import('@/components/GameManager'), { ssr: false })

export default function Home() {
  return (
    <main className="flex-1 w-full h-[100dvh] overflow-hidden bg-[var(--bg-primary)]">
      <GameManager />
    </main>
  );
}
