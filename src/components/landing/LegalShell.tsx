import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import LandingFooter from './LandingFooter'

/**
 * /terms, /privacy 공용 레이아웃 (서버 컴포넌트).
 * body가 overflow-hidden이므로 자체 스크롤 컨테이너를 만든다.
 */
export default function LegalShell({
  title,
  subtitle,
  effectiveDate,
  version,
  children,
}: {
  title: string
  subtitle: string
  effectiveDate: string
  version: string
  children: React.ReactNode
}) {
  return (
    <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden scroll-smooth bg-[var(--bg-primary)]">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--panel-border)]">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Rolling Thunder 홈
          </Link>
          <nav className="flex items-center gap-3 text-xs">
            <Link href="/terms" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              이용약관
            </Link>
            <Link href="/privacy" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              개인정보처리방침
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-outfit font-bold text-[var(--text-primary)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{subtitle}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full border border-[var(--panel-border-hover)] bg-[var(--panel-bg)] text-[var(--text-muted)]">
            시행일 {effectiveDate}
          </span>
          <span className="px-2.5 py-1 rounded-full border border-[var(--panel-border-hover)] bg-[var(--panel-bg)] text-[var(--text-muted)]">
            버전 {version}
          </span>
        </div>
        <div className="mt-10 flex flex-col gap-10">{children}</div>
      </main>

      <LandingFooter />
    </div>
  )
}

/** 조항 섹션: 앵커 이동 시 sticky 헤더에 가리지 않도록 scroll-mt 부여 */
export function Article({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--panel-border)]">{title}</h2>
      <div className="text-sm leading-7 text-[var(--text-secondary)] flex flex-col gap-2 [&_strong]:text-[var(--text-primary)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1">
        {children}
      </div>
    </section>
  )
}

/** 문서 상단 목차 */
export function Toc({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="목차" className="glass-panel p-5">
      <div className="text-xs font-bold tracking-widest text-[var(--text-muted)] mb-3">목차</div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex items-baseline gap-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
            >
              <span className="text-xs text-[var(--text-faint)] font-mono w-5 shrink-0 text-right">{i + 1}.</span>
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** 중요 조항 강조 박스 (약관규제법 '중요 내용 명확 표시' 요건) */
export function Important({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--accent-warning)]/30 bg-[var(--accent-warning)]/10 px-4 py-3 text-[var(--text-primary)] font-medium">
      {children}
    </div>
  )
}
