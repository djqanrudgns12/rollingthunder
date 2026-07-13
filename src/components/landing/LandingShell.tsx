'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Play, Sparkles } from 'lucide-react'
import confetti from 'canvas-confetti'
import { soundManager } from '@/engine/AudioEngine'
import { useGameStore } from '@/store/gameStore'
import HeroPhysics, { type HeroPhysicsHandle } from './HeroPhysics'
import AuthDialog, { type AuthMode } from './AuthDialog'
import InstallAppButton from '@/components/pwa/InstallAppButton'

/**
 * 랜딩 페이지 클라이언트 셸.
 * 정적 섹션(sections/footer)은 서버 컴포넌트로 렌더링되어 children으로 주입된다.
 * body가 overflow-hidden이므로 자체 스크롤 컨테이너를 구성한다.
 */
export default function LandingShell({
  sections,
  footer,
}: {
  sections: React.ReactNode
  footer: React.ReactNode
}) {
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [demoMessage, setDemoMessage] = useState<string | null>(null)
  const physicsRef = useRef<HeroPhysicsHandle>(null)
  const demoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    soundManager.stopAllBgm()
  }, [])

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  const handleGuest = () => {
    router.push('/dashboard')
  }

  const handleDemoSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const raw = demoInputRef.current?.value ?? ''
    const names = raw
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter(Boolean)
    if (names.length === 0) return
    physicsRef.current?.spawnNames(names)
    setDemoMessage(`🎉 ${Math.min(names.length, 12)}명의 칩이 입장했습니다! 진짜 레이스는 대기실에서 —`)
    if (demoInputRef.current) demoInputRef.current.value = ''

    // 투하 축포 — 차분 모드/모션 저감 환경에서는 생략 (disableForReducedMotion은 OS 설정을 자동 존중)
    if (!useGameStore.getState().calmMode) {
      confetti({
        particleCount: 50,
        spread: 70,
        startVelocity: 35,
        origin: { x: 0.5, y: 0.55 },
        colors: ['#00ffcc', '#b26bf2', '#ffb133', '#f95fa8'],
        disableForReducedMotion: true,
        zIndex: 60,
      })
    }
  }

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden scroll-smooth bg-[var(--bg-primary)]">
      {/* 키보드 사용자용 본문 바로가기 */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--accent-primary)] focus:text-black focus:font-bold"
      >
        본문으로 건너뛰기
      </a>
      {/* 헤더 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--bg-primary)]/75 border-b border-[var(--panel-border)]">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-2.5 shrink-0">
            <img src="/icon.png" alt="" className="w-8 h-8 object-contain" />
            <span className="font-outfit font-bold tracking-[0.15em] text-[var(--text-primary)] hidden sm:inline">
              ROLLING THUNDER
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--text-secondary)]">
            <a href="#features" className="hover:text-[var(--text-primary)] transition-colors">기능</a>
            <a href="#how" className="hover:text-[var(--text-primary)] transition-colors">사용 방법</a>
            <a href="#faq" className="hover:text-[var(--text-primary)] transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {/* PWA 설치 (설치 가능/미설치 환경에서만 노출) */}
            <InstallAppButton variant="header" />
            <button
              onClick={() => openAuth('login')}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-primary)] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              로그인
            </button>
            <button
              onClick={() => openAuth('signup')}
              className="px-4 py-2 rounded-lg text-sm font-bold text-[var(--text-primary)] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              회원가입
            </button>
            {/* 비회원 게스트 진입: 가입 없이 곧바로 대기실(/dashboard)로 이동 */}
            <button
              onClick={handleGuest}
              className="px-4 py-2 rounded-lg text-sm font-bold text-black bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 transition-colors shadow-[0_0_15px_rgba(0,255,204,0.25)]"
            >
              비회원으로 시작하기
            </button>
          </div>
        </div>
      </header>

      <main id="main">
      {/* 히어로 */}
      <section id="top" className="relative min-h-[calc(100dvh-4rem)] flex flex-col items-center justify-center overflow-hidden">
        {/* 정적 배경 (모션 저감 시에도 항상 표시되는 폴백) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 45% at 20% 15%, hsla(170,100%,50%,0.10), transparent), radial-gradient(ellipse 55% 45% at 80% 25%, hsla(280,80%,65%,0.12), transparent), radial-gradient(ellipse 70% 40% at 50% 100%, hsla(170,100%,50%,0.06), transparent)',
          }}
        />
        <HeroPhysics ref={physicsRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-5 py-24 text-center flex flex-col items-center gap-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-sm font-bold text-[var(--accent-primary)] backdrop-blur-md shadow-[0_0_20px_rgba(0,255,204,0.15)]">
            <Sparkles className="w-4 h-4" />
            선생님을 위한 가장 완벽한 학급 뽑기 도구
          </div>

          <h1 className="font-outfit font-extrabold text-5xl sm:text-6xl md:text-7xl leading-[1.15] text-white tracking-tight">
            사다리타기는 이제 그만.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-primary)] via-cyan-300 to-[var(--accent-secondary)] pb-2">
              아이들이 열광하는 레이스
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-[var(--text-secondary)] leading-relaxed max-w-2xl font-medium">
            이름만 넣으면 진짜 물리 법칙으로 굴러가는 짜릿한 뽑기가 시작됩니다. 
            <br className="hidden sm:block" />
            복잡한 설치 없이, 교실 화면에 띄우기만 하세요!
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
            <button
              onClick={() => openAuth('signup')}
              className="group relative px-8 py-4 rounded-full font-extrabold text-black text-lg bg-gradient-to-r from-[var(--accent-primary)] to-[#00ffcc] hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(0,255,204,0.4)]"
            >
              <span className="absolute inset-0 w-full h-full rounded-full opacity-0 group-hover:opacity-50 blur-md bg-gradient-to-r from-[var(--accent-primary)] to-[#00ffcc] transition-opacity duration-300"></span>
              <span className="relative flex items-center gap-2">
                무료로 시작하기 <Play className="w-5 h-5 fill-black" />
              </span>
            </button>
            <button
              onClick={handleGuest}
              className="px-8 py-4 rounded-full font-bold text-white bg-white/5 hover:bg-white/10 border border-white/20 transition-all duration-300 hover:scale-105 backdrop-blur-md"
            >
              가입 없이 바로 체험하기
            </button>
          </div>

          {/* 라이브 미니 데모: 이름을 넣으면 물리 칩이 즉시 투하된다 */}
          <div className="w-full max-w-lg mt-8 relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-2xl blur opacity-20 animate-pulse"></div>
            <div className="relative bg-black/60 backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-2">
              <form
                onSubmit={handleDemoSubmit}
                className="flex items-stretch gap-2 h-14"
              >
                <div className="flex-1 flex items-center bg-black/40 rounded-xl px-4 border border-white/5 focus-within:border-[var(--accent-primary)]/50 transition-colors">
                  <input
                    ref={demoInputRef}
                    type="text"
                    maxLength={100}
                    placeholder="이름 입력 (예: 철수, 영희, 민준)"
                    className="w-full bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none"
                    aria-label="데모 참가자 이름 입력"
                  />
                </div>
                <button
                  type="submit"
                  className="shrink-0 px-6 rounded-xl font-bold text-black bg-gradient-to-r from-[var(--accent-primary)] to-cyan-400 hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(0,255,204,0.4)] flex items-center gap-1"
                >
                  투하! <ChevronDown className="w-5 h-5" />
                </button>
              </form>
              
              <div className="flex items-center justify-between px-2 text-[11px] sm:text-xs">
                <span className="text-white/50 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                  배경의 칩들을 마우스로 밀어보세요
                </span>
                <button 
                  type="button" 
                  onClick={() => {
                    if (demoInputRef.current) demoInputRef.current.value = '지민, 서연, 민준, 도윤, 하은, 예준, 우진, 지호'
                  }}
                  className="text-[var(--accent-secondary)] hover:text-white transition-colors font-medium"
                >
                  + 예시 명단 채우기
                </button>
              </div>

              {demoMessage && (
                <div aria-live="polite" className="mt-2 text-sm text-[var(--accent-primary)] font-medium animate-in fade-in slide-in-from-bottom-2">
                  {demoMessage}{' '}
                  <button onClick={handleGuest} className="text-white hover:underline underline-offset-4 ml-2">
                    대기실 입장하기 →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <a
          href="#features"
          aria-label="기능 소개로 스크롤"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors motion-safe:animate-bounce"
        >
          <ChevronDown className="w-6 h-6" />
        </a>
      </section>

      {/* 서버 렌더링 섹션 (기능/사용 방법/기술 스택) */}
      {sections}

      {/* 최종 CTA */}
      <section className="relative overflow-hidden border-t border-[var(--panel-border)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 50% 100%, hsla(280,80%,65%,0.12), transparent)',
          }}
        />
        <div className="relative max-w-3xl mx-auto px-5 py-24 text-center flex flex-col items-center gap-5">
          <h2 className="font-outfit font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
            지금, 중력에게 맡겨보세요
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            회원가입은 10초면 충분합니다. 이메일도 필요 없어요.
            <br />
            비회원으로 모은 칩과 아이템은 가입할 때 자동으로 승계됩니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
            <button
              onClick={() => openAuth('signup')}
              className="px-8 py-3.5 rounded-xl font-extrabold text-black text-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(0,255,204,0.35)]"
            >
              무료로 시작하기
            </button>
            <button
              onClick={handleGuest}
              className="px-8 py-3.5 rounded-xl font-medium text-[var(--text-primary)] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              비회원으로 계속하기
            </button>
          </div>
        </div>
      </section>
      </main>

      {footer}

      <AuthDialog open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onModeChange={setAuthMode} />
    </div>
  )
}
