'use client'

import { useState, useSyncExternalStore } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { Download, Share2, Plus, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getGuidePlatform,
  getInstallStatusSnapshot,
  getInstallStatusServerSnapshot,
  promptInstall,
  subscribeInstallStatus,
  type GuidePlatform,
} from '@/lib/pwaInstall'

type GuideStep = { icon: typeof Download; text: React.ReactNode }

const GUIDES: Record<GuidePlatform, { title: string; steps: GuideStep[]; note?: string }> = {
  ios: {
    title: '아이폰·아이패드에 설치하기',
    steps: [
      { icon: Share2, text: <>Safari 하단의 <strong>공유 버튼</strong>을 누르세요 (아이패드는 상단)</> },
      { icon: Plus, text: <>목록에서 <strong>&lsquo;홈 화면에 추가&rsquo;</strong>를 선택하세요</> },
      { icon: Check, text: <>오른쪽 위 <strong>&lsquo;추가&rsquo;</strong>를 누르면 설치 완료!</> },
    ],
    note: 'iOS용 Chrome 등 다른 브라우저에서도 공유 메뉴에서 같은 방법으로 추가할 수 있어요 (iOS 16.4 이상).',
  },
  android: {
    title: '안드로이드에 설치하기',
    steps: [
      { icon: Download, text: <>브라우저 <strong>메뉴(⋮)</strong>를 열고 <strong>&lsquo;앱 설치&rsquo;</strong> 또는 <strong>&lsquo;홈 화면에 추가&rsquo;</strong>를 선택하세요</> },
      { icon: Check, text: <>확인을 누르면 홈 화면에 아이콘이 생겨요</> },
    ],
    note: 'Chrome에서는 잠시 후 주소창 근처에 설치 안내가 자동으로 나타나기도 해요.',
  },
  desktop: {
    title: '내 컴퓨터에 설치하기',
    steps: [
      { icon: Download, text: <>주소창 오른쪽 끝의 <strong>설치 아이콘</strong>을 클릭하세요</> },
      { icon: Check, text: <><strong>&lsquo;설치&rsquo;</strong>를 누르면 독립 창 앱으로 실행돼요</> },
    ],
    note: '아이콘이 안 보이면 브라우저 메뉴(⋮)에서 "앱 설치"를 찾아보세요. Firefox는 PWA 설치를 지원하지 않아 Chrome/Edge 이용을 권장해요.',
  },
}

/**
 * PWA 설치 버튼.
 * - 설치 프롬프트가 가능한 브라우저(Chrome/Edge 계열)에서는 네이티브 프롬프트를 바로 띄우고,
 * - iOS 등 프롬프트가 없는 환경에서는 플랫폼별 설치 가이드 다이얼로그를 보여준다.
 * - 이미 설치된 상태(standalone/fullscreen 실행)에서는 렌더되지 않는다.
 */
export default function InstallAppButton({ variant = 'header' }: { variant?: 'header' | 'round' }) {
  const status = useSyncExternalStore(subscribeInstallStatus, getInstallStatusSnapshot, getInstallStatusServerSnapshot)
  const [guideOpen, setGuideOpen] = useState(false)
  const [platform, setPlatform] = useState<GuidePlatform>('desktop')
  const [waiting, setWaiting] = useState(false)

  if (status === 'unknown' || status === 'installed') return null

  const handleClick = async () => {
    if (waiting) return
    // 항상 네이티브 프롬프트를 먼저 시도한다.
    // 이벤트가 아직 도착하지 않은 경우(promptInstall이 최대 1.8초 대기) 스피너를 보여준다.
    setWaiting(true)
    const outcome = await promptInstall()
    setWaiting(false)

    if (outcome === 'accepted') {
      toast.success('설치가 시작되었습니다! 홈 화면에서 만나요 🎉')
      return
    }
    if (outcome === 'dismissed') return // 사용자가 프롬프트를 닫음 — 조용히 종료

    // 네이티브 프롬프트가 정말 불가능한 환경(iOS, Firefox 등)만 플랫폼별 안내로 폴백
    setPlatform(getGuidePlatform())
    setGuideOpen(true)
  }

  const guide = GUIDES[platform]

  return (
    <>
      {variant === 'header' ? (
        <button
          onClick={handleClick}
          disabled={waiting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-primary)] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-60"
        >
          {waiting ? (
            <Loader2 className="w-4 h-4 text-[var(--accent-primary)] animate-spin" />
          ) : (
            <Download className="w-4 h-4 text-[var(--accent-primary)]" />
          )}
          <span className="hidden sm:inline">앱 설치</span>
        </button>
      ) : (
        <button
          onClick={handleClick}
          disabled={waiting}
          title="앱 설치"
          aria-label="앱 설치"
          className="w-12 h-12 rounded-full bg-[var(--panel-bg-heavy)] backdrop-blur-md border border-[var(--panel-border-hover)] flex items-center justify-center hover:bg-[var(--btn-bg-hover)] transition-all hover:scale-110 shadow-lg group disabled:opacity-60"
        >
          {waiting ? (
            <Loader2 className="w-6 h-6 text-[var(--accent-primary)] animate-spin" />
          ) : (
            <Download className="w-6 h-6 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
          )}
        </button>
      )}

      <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} className="relative z-[10000]">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/80 backdrop-blur-sm duration-200 data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel
            transition
            className="relative w-full max-w-sm flex flex-col overflow-hidden rounded-2xl bg-[var(--bg-secondary)] border border-white/10 shadow-2xl duration-200 data-[closed]:opacity-0 data-[closed]:scale-95"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-50" />

            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)]">
                <Download className="w-5 h-5 text-[var(--accent-primary)]" />
                {guide.title}
              </DialogTitle>
              <button
                onClick={() => setGuideOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                설치하면 홈 화면 아이콘 하나로 바로 실행되고, 전체 화면 앱처럼 동작해요.
              </p>

              <ol className="flex flex-col gap-3">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
                    <span className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                      <step.icon className="w-4 h-4 text-[var(--accent-primary)]" />
                    </span>
                    <span className="text-sm leading-6 text-[var(--text-secondary)] [&_strong]:text-[var(--text-primary)]">
                      {step.text}
                    </span>
                  </li>
                ))}
              </ol>

              {guide.note && (
                <p className="text-xs leading-5 text-[var(--text-faint)]">{guide.note}</p>
              )}

              <button
                onClick={() => setGuideOpen(false)}
                className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-black font-bold py-3 rounded-lg transition-colors"
              >
                확인
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
