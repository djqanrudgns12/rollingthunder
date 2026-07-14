'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useGameStore } from '@/store/gameStore'

/**
 * 스크롤 진입 시 나타나는 리빌 래퍼.
 * - 서버 컴포넌트 섹션 안에서 카드/블록 단위로 감싸 쓴다.
 * - OS 모션 저감(prefers-reduced-motion) 또는 차분 모드에서는 애니메이션 없이 정적 렌더.
 * - 변환은 opacity/y만 사용 — 글래스 패널(backdrop-filter)의 스태킹 컨텍스트를 흔들지 않는다.
 *
 * [Hydration 안전] 서버/클라이언트에서 항상 동일한 `motion.div` 트리를 렌더링한다.
 * 모션 비활성화 시에는 initial 값을 최종 상태(opacity:1, y:0)로 설정하여
 * 동일 DOM 구조를 유지하면서 애니메이션만 생략한다.
 */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const reducedMotion = useReducedMotion()
  const calmMode = useGameStore((s) => s.calmMode)

  const skipAnimation = reducedMotion || calmMode

  return (
    <motion.div
      className={className}
      initial={skipAnimation ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      {...(skipAnimation
        ? {}
        : {
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, amount: 0.2 },
            transition: { duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] },
          })}
    >
      {children}
    </motion.div>
  )
}
