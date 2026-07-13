import Link from 'next/link'

/**
 * 랜딩/법적 문서 페이지 공용 푸터.
 * 개인정보처리방침 링크는 다른 링크와 구분되도록 강조 표시(개인정보 보호법 §30③ 공개 방법 요건).
 */
export default function LandingFooter() {
  return (
    <footer className="border-t border-[var(--panel-border)] bg-black/20">
      <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="Rolling Thunder" className="w-9 h-9 object-contain" />
            <div>
              <div className="font-outfit font-bold tracking-[0.2em] text-[var(--text-primary)]">ROLLING THUNDER</div>
              <div className="text-xs text-[var(--text-secondary)]">물리 엔진 기반 무작위 추첨 레이스</div>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/terms" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              서비스 이용약관
            </Link>
            <span className="text-[var(--text-faint)]">·</span>
            <Link href="/privacy" className="font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              개인정보처리방침
            </Link>
          </nav>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pt-4 border-t border-[var(--panel-border)] text-[11px] text-[var(--text-faint)]">
          <div className="flex items-center tracking-wide">
            © Copyright
            <img src="/images/assets/chaltteok.png" alt="" className="w-4 h-4 mx-1 object-contain" />
            찰떡쌤. 단순한 뽑기도 즐거움을 누려 보세요!
          </div>
          <div>
            개발자: 찰떡쌤 · 문의:{' '}
            <a
              href="mailto:rudgnswh12@naver.com"
              className="underline underline-offset-2 hover:text-[var(--text-muted)] transition-colors"
            >
              rudgnswh12@naver.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
