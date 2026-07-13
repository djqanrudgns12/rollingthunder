'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Checkbox, Dialog, DialogBackdrop, DialogPanel, DialogTitle, Field, Label } from '@headlessui/react'
import { Check, ScrollText, LogOut } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { recordConsentAction } from '@/presentation/actions/consentActions'
import { logout } from '@/app/actions'
import { LEGAL_EFFECTIVE_DATE, LEGAL_LABEL } from '@/lib/legal'

function ConsentRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Field className="flex items-start gap-2.5">
      <Checkbox
        checked={checked}
        onChange={onChange}
        className="group mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-white/20 bg-black/30 cursor-pointer transition-colors data-[checked]:border-[var(--accent-primary)] data-[checked]:bg-[var(--accent-primary)] data-[focus]:ring-1 data-[focus]:ring-[var(--accent-primary)]/50"
      >
        <Check className="hidden size-3 text-black group-data-[checked]:block" strokeWidth={3.5} />
      </Checkbox>
      <Label className="text-sm leading-6 text-[var(--text-secondary)] select-none cursor-pointer">{children}</Label>
    </Field>
  )
}

/**
 * 기존 회원 재동의 게이트.
 * 현재 시행 버전의 약관/처리방침에 동의 이력이 없는 회원에게 로그인 직후 표시된다.
 * 동의하거나 로그아웃하기 전까지 닫을 수 없다(ESC/백드롭 무시).
 */
export default function ReconsentModal() {
  const { activeModal, setActiveModal } = useUIStore()
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = activeModal === 'reconsent'

  const handleAgree = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await recordConsentAction()
      if (result.success) {
        setActiveModal('none')
      } else {
        setError('동의 처리에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } catch (err) {
      console.error(err)
      setError('동의 처리에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      await logout()
    } finally {
      window.location.href = '/'
    }
  }

  return (
    <Dialog open={open} onClose={() => {}} className="relative z-[10000]">
      <DialogBackdrop transition className="fixed inset-0 bg-black/80 backdrop-blur-sm duration-200 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="relative w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden rounded-2xl bg-[var(--bg-secondary)] border border-white/10 shadow-2xl duration-200 data-[closed]:opacity-0 data-[closed]:scale-95"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-50" />

          <div className="p-6 overflow-y-auto flex-1 min-h-0 flex flex-col gap-5">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center">
                <ScrollText className="w-6 h-6 text-[var(--accent-primary)]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[var(--text-primary)]">
                약관이 새로 시행되었습니다
              </DialogTitle>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                서비스 이용약관과 개인정보처리방침({LEGAL_LABEL}, 시행일 {LEGAL_EFFECTIVE_DATE})이 시행되어,
                계속 이용하시려면 동의가 필요합니다. 각 문서는 새 탭에서 열립니다.
              </p>
            </div>

            <div className="flex flex-col gap-3 p-4 rounded-xl bg-black/20 border border-white/5">
              <ConsentRow checked={termsAgreed} onChange={setTermsAgreed}>
                <Link href="/terms" target="_blank" className="text-[var(--accent-primary)] underline underline-offset-2 hover:text-white transition-colors">
                  서비스 이용약관
                </Link>
                에 동의합니다. (필수)
              </ConsentRow>
              <ConsentRow checked={privacyAgreed} onChange={setPrivacyAgreed}>
                <Link href="/privacy" target="_blank" className="text-[var(--accent-primary)] underline underline-offset-2 hover:text-white transition-colors">
                  개인정보처리방침
                </Link>
                을 확인했으며 개인정보 수집·이용에 동의합니다. (필수)
              </ConsentRow>
            </div>

            {error && (
              <div aria-live="polite" className="text-[var(--accent-warning)] text-sm p-3 bg-[var(--accent-warning)]/10 rounded-lg border border-[var(--accent-warning)]/20 flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <span className="leading-tight">{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleAgree}
                disabled={loading || !termsAgreed || !privacyAgreed}
                className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-lg transition-colors shadow-[0_0_15px_rgba(0,255,204,0.3)]"
              >
                {loading ? '처리 중...' : '동의하고 계속'}
              </button>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="w-full py-3 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                동의하지 않고 로그아웃
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
