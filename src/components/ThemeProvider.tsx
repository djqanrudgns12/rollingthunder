'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, fontFamily } = useGameStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return;

    // Apply theme
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // Apply font
    if (fontFamily === 'pretendard') {
      document.documentElement.style.fontFamily = `var(--font-pretendard), sans-serif`;
    } else {
      document.documentElement.style.fontFamily = `var(--font-${fontFamily}), sans-serif`;
    }
  }, [theme, fontFamily, mounted])

  // Prevent hydration mismatch by not rendering until mounted if needed, 
  // but since we apply to documentElement, we can just return children.
  // The layout will flash unstyled on first render if SSR, which is standard without next-themes.
  return <>{children}</>
}
