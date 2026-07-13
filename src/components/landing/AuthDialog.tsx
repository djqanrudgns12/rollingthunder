'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Checkbox,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Field,
  Input,
  Label,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from '@headlessui/react'
import { X, Check, LogIn, UserPlus } from 'lucide-react'
import { login, signup } from '@/app/actions'
import { useChipStore } from '@/store/chipStore'
import { useInventoryStore } from '@/store/inventoryStore'

export type AuthMode = 'login' | 'signup'

const INPUT_CLASS =
  'w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none data-[focus]:border-[var(--accent-primary)] data-[focus]:ring-1 data-[focus]:ring-[var(--accent-primary)]/50 transition-all placeholder:text-[var(--text-faint)]'

const LABEL_CLASS = 'text-sm font-medium text-[var(--text-primary)]'

function ConsentCheckbox({
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
      <Label className="text-xs leading-5 text-[var(--text-secondary)] select-none cursor-pointer">{children}</Label>
    </Field>
  )
}

function KeepLoggedInCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Field className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        onChange={onChange}
        className="group flex size-4 shrink-0 items-center justify-center rounded border border-white/20 bg-black/30 cursor-pointer transition-colors data-[checked]:border-[var(--accent-primary)] data-[checked]:bg-[var(--accent-primary)] data-[focus]:ring-1 data-[focus]:ring-[var(--accent-primary)]/50"
      >
        <Check className="hidden size-3 text-black group-data-[checked]:block" strokeWidth={3.5} />
      </Checkbox>
      <Label className="text-sm text-[var(--text-secondary)] select-none cursor-pointer">로그인 상태 유지</Label>
    </Field>
  )
}

/**
 * 랜딩 페이지 로그인/회원가입 다이얼로그 (Headless UI v2).
 * 검증 규칙과 게스트 데이터 승계 로직은 기존 로그인 페이지/AuthModal과 동일하게 유지한다.
 */
export default function AuthDialog({
  open,
  mode,
  onClose,
  onModeChange,
}: {
  open: boolean
  mode: AuthMode
  onClose: () => void
  onModeChange: (mode: AuthMode) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [keepLogin, setKeepLogin] = useState(true)
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)

  const close = () => {
    setError(null)
    onClose()
  }

  const runAuth = async (action: typeof login, formData: FormData) => {
    try {
      const result = await action(formData)
      if (result?.error) setError(result.error)
      if (result?.success) window.location.href = '/dashboard'
    } catch (err) {
      const e = err as { message?: string; digest?: string }
      if (e?.message === 'NEXT_REDIRECT' || e?.digest?.startsWith('NEXT_REDIRECT')) throw err
      console.error(err)
      setError('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('keepLoggedIn', String(keepLogin))

    const username = formData.get('username') as string
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError('아이디는 영문, 숫자, 밑줄(_) 3~20자로 입력해주세요.')
      setLoading(false)
      return
    }

    await runAuth(login, formData)
  }

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('keepLoggedIn', String(keepLogin))
    formData.set('termsAgreed', String(termsAgreed))
    formData.set('privacyAgreed', String(privacyAgreed))

    const username = formData.get('username') as string
    const password = formData.get('password') as string
    const passwordConfirm = formData.get('passwordConfirm') as string
    const name = formData.get('name') as string
    const nickname = formData.get('nickname') as string

    if (!name || name.trim() === '') {
      setError('이름을 입력해주세요.')
      setLoading(false)
      return
    }
    if (!nickname || nickname.trim() === '') {
      setError('닉네임을 입력해주세요.')
      setLoading(false)
      return
    }
    if (nickname.trim().length > 10) {
      setError('닉네임은 최대 10자까지 입력할 수 있습니다.')
      setLoading(false)
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      setLoading(false)
      return
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError('아이디는 영문, 숫자, 밑줄(_) 3~20자로 입력해주세요.')
      setLoading(false)
      return
    }
    if (!termsAgreed || !privacyAgreed) {
      setError('이용약관과 개인정보처리방침에 동의해주세요.')
      setLoading(false)
      return
    }

    // 게스트 진행 데이터(칩, 인벤토리, 장착) 승계
    const chips = useChipStore.getState().chips
    const { inventory, equipped } = useInventoryStore.getState()
    formData.set('guestChips', String(chips))
    formData.set('guestInventory', JSON.stringify(inventory))
    formData.set('guestEquipped', JSON.stringify(equipped))

    await runAuth(signup, formData)
  }

  return (
    <Dialog open={open} onClose={close} className="relative z-[10000]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/80 backdrop-blur-sm duration-200 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="relative w-full max-w-sm max-h-[90dvh] flex flex-col overflow-hidden rounded-2xl bg-[var(--bg-secondary)] border border-white/10 shadow-2xl duration-200 data-[closed]:opacity-0 data-[closed]:scale-95"
        >
          {/* 네온 장식 효과 */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-50" />

          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20 shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
              {mode === 'login' ? (
                <LogIn className="w-5 h-5 text-[var(--accent-primary)]" />
              ) : (
                <UserPlus className="w-5 h-5 text-[var(--accent-primary)]" />
              )}
              {mode === 'login' ? '로그인' : '회원가입'}
            </DialogTitle>
            <button
              onClick={close}
              className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            <TabGroup
              selectedIndex={mode === 'login' ? 0 : 1}
              onChange={(index) => {
                setError(null)
                onModeChange(index === 0 ? 'login' : 'signup')
              }}
            >
              <TabList className="flex gap-1 p-1 rounded-xl bg-black/30 border border-white/10 mb-6">
                {(['로그인', '회원가입'] as const).map((label) => (
                  <Tab
                    key={label}
                    className="flex-1 py-2 rounded-lg text-sm font-bold text-[var(--text-secondary)] transition-colors focus:outline-none data-[hover]:text-[var(--text-primary)] data-[selected]:bg-[var(--accent-primary)] data-[selected]:text-black"
                  >
                    {label}
                  </Tab>
                ))}
              </TabList>

              <TabPanels>
                {/* 로그인 */}
                <TabPanel>
                  <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <Field className="flex flex-col gap-1.5">
                      <Label className={LABEL_CLASS}>아이디</Label>
                      <Input name="username" type="text" required className={INPUT_CLASS} placeholder="아이디를 입력해주세요" />
                    </Field>
                    <Field className="flex flex-col gap-1.5">
                      <Label className={LABEL_CLASS}>비밀번호</Label>
                      <Input name="password" type="password" required className={INPUT_CLASS} placeholder="••••••••" />
                    </Field>
                    <KeepLoggedInCheckbox checked={keepLogin} onChange={setKeepLogin} />

                    {error && (
                      <div aria-live="polite" className="text-[var(--accent-warning)] text-sm p-3 bg-[var(--accent-warning)]/10 rounded-lg border border-[var(--accent-warning)]/20 flex items-start gap-2">
                        <span className="mt-0.5">⚠️</span>
                        <span className="leading-tight">{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-lg transition-colors mt-1 shadow-[0_0_15px_rgba(0,255,204,0.3)]"
                    >
                      {loading ? '처리 중...' : '로그인'}
                    </button>
                  </form>
                </TabPanel>

                {/* 회원가입 */}
                <TabPanel>
                  <form onSubmit={handleSignup} className="flex flex-col gap-4">
                    <Field className="flex flex-col gap-1.5">
                      <Label className={LABEL_CLASS}>이름</Label>
                      <Input name="name" type="text" required className={INPUT_CLASS} placeholder="홍길동" />
                    </Field>
                    <Field className="flex flex-col gap-1.5">
                      <Label className={LABEL_CLASS}>닉네임</Label>
                      <Input name="nickname" type="text" required maxLength={10} className={INPUT_CLASS} placeholder="게임에서 사용할 닉네임 (최대 10자)" />
                    </Field>
                    <Field className="flex flex-col gap-1.5">
                      <Label className={LABEL_CLASS}>아이디</Label>
                      <Input name="username" type="text" required className={INPUT_CLASS} placeholder="영문, 숫자, 밑줄 3~20자" />
                    </Field>
                    <Field className="flex flex-col gap-1.5">
                      <Label className={LABEL_CLASS}>비밀번호</Label>
                      <Input name="password" type="password" required className={INPUT_CLASS} placeholder="••••••••" />
                    </Field>
                    <Field className="flex flex-col gap-1.5">
                      <Label className={LABEL_CLASS}>비밀번호 확인</Label>
                      <Input name="passwordConfirm" type="password" required className={INPUT_CLASS} placeholder="••••••••" />
                    </Field>
                    <KeepLoggedInCheckbox checked={keepLogin} onChange={setKeepLogin} />

                    <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-black/20 border border-white/5">
                      <ConsentCheckbox checked={termsAgreed} onChange={setTermsAgreed}>
                        <Link href="/terms" target="_blank" className="text-[var(--accent-primary)] underline underline-offset-2 hover:text-white transition-colors">
                          서비스 이용약관
                        </Link>
                        에 동의합니다. (필수)
                      </ConsentCheckbox>
                      <ConsentCheckbox checked={privacyAgreed} onChange={setPrivacyAgreed}>
                        <Link href="/privacy" target="_blank" className="text-[var(--accent-primary)] underline underline-offset-2 hover:text-white transition-colors">
                          개인정보처리방침
                        </Link>
                        을 확인했으며 개인정보 수집·이용에 동의합니다. (필수)
                      </ConsentCheckbox>
                    </div>

                    {error && (
                      <div aria-live="polite" className="text-[var(--accent-warning)] text-sm p-3 bg-[var(--accent-warning)]/10 rounded-lg border border-[var(--accent-warning)]/20 flex items-start gap-2">
                        <span className="mt-0.5">⚠️</span>
                        <span className="leading-tight">{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !termsAgreed || !privacyAgreed}
                      className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-lg transition-colors mt-1 shadow-[0_0_15px_rgba(0,255,204,0.3)]"
                    >
                      {loading ? '처리 중...' : '계정 생성'}
                    </button>
                    <p className="text-[11px] text-[var(--text-faint)] text-center leading-relaxed">
                      비회원으로 모아둔 칩과 아이템은 가입 시 자동으로 계정에 승계됩니다.
                    </p>
                  </form>
                </TabPanel>
              </TabPanels>
            </TabGroup>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
