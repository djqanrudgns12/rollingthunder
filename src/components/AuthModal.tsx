'use client'

import { useState, useEffect } from 'react'
import { login, signup } from '@/app/actions'
import { useUIStore } from '@/store/uiStore'
import { useChipStore } from '@/store/chipStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { X, LogIn, UserPlus } from 'lucide-react'

export default function AuthModal() {
  const { activeModal, setActiveModal, authMode } = useUIStore()
  const [isLogin, setIsLogin] = useState(authMode === 'login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setIsLogin(authMode === 'login')
  }, [authMode])

  if (activeModal !== 'auth') return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const username = formData.get('username') as string
    
    // 회원가입일 경우 추가 검증 및 게스트 데이터 동기화
    if (!isLogin) {
      const password = formData.get('password') as string
      const passwordConfirm = formData.get('passwordConfirm') as string
      const name = formData.get('name') as string

      if (!name || name.trim() === '') {
        setError("이름을 입력해주세요.")
        setLoading(false)
        return
      }

      if (password !== passwordConfirm) {
        setError("비밀번호가 일치하지 않습니다.")
        setLoading(false)
        return
      }

      // 게스트 데이터 (현재 zustand 스토어) 추출 후 주입
      const chips = useChipStore.getState().chips
      const { inventory, equipped } = useInventoryStore.getState()
      
      formData.append('guestChips', String(chips))
      formData.append('guestInventory', JSON.stringify(inventory))
      formData.append('guestEquipped', JSON.stringify(equipped))
    }

    // 엄격한 아이디 유효성 검사 (정규식)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError("아이디는 영문, 숫자, 밑줄(_) 3~20자로 입력해주세요.")
      setLoading(false)
      return
    }

    try {
      if (isLogin) {
        const result = await login(formData)
        if (result?.error) {
          setError(result.error)
          return
        }
        if (result?.success) {
          window.location.href = '/dashboard'
          return
        }
      } else {
        const result = await signup(formData)
        if (result?.error) {
          setError(result.error)
          return
        }
        if (result?.success) {
          window.location.href = '/dashboard'
          return
        }
      }
      
      setActiveModal('none')
    } catch (err: any) {
      // Server Action redirect throws an error on the client in some Next.js versions.
      // err.digest is usually "NEXT_REDIRECT"
      if (err?.message === 'NEXT_REDIRECT' || err?.digest?.startsWith('NEXT_REDIRECT')) {
        setActiveModal('none')
        throw err;
      }
      console.error(err)
      setError("오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm max-h-[90dvh] bg-[var(--bg-secondary)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        
        {/* 네온 장식 효과 */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-50" />
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20 shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {isLogin ? <LogIn className="w-5 h-5 text-[var(--accent-primary)]" /> : <UserPlus className="w-5 h-5 text-[var(--accent-primary)]" />}
            {isLogin ? '로그인' : '회원가입'}
          </h2>
          <button 
            onClick={() => {
              setActiveModal('none')
              setError(null)
            }}
            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pb-8 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6 text-center">
            {isLogin ? 'Rolling Thunder 세션을 불러옵니다.' : '계정을 생성하고 여러 기능을 누려보세요.'}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 이름 입력창 (회원가입 시에만 표시) */}
            {!isLogin && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium text-[var(--text-primary)]">
                  이름
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required={!isLogin}
                  className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/50 transition-all"
                  placeholder="홍길동"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-sm font-medium text-[var(--text-primary)]">
                아이디
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/50 transition-all"
                placeholder="아이디를 입력해주세요"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[var(--text-primary)]">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/50 transition-all"
                placeholder="••••••••"
              />
            </div>

            {/* 비밀번호 확인 입력창 (회원가입 시에만 표시) */}
            {!isLogin && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="passwordConfirm" className="text-sm font-medium text-[var(--text-primary)]">
                  비밀번호 확인
                </label>
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  required={!isLogin}
                  className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/50 transition-all"
                  placeholder="••••••••"
                />
              </div>
            )}

            {/* 로그인 상태 유지 체크박스 */}
            <div className="flex items-center gap-2 mt-1">
              <input
                id="keepLoggedIn"
                name="keepLoggedIn"
                type="checkbox"
                value="true"
                defaultChecked={true}
                className="w-4 h-4 rounded border-white/20 bg-black/30 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]/50 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="keepLoggedIn" className="text-sm text-[var(--text-secondary)] select-none cursor-pointer">
                로그인 상태 유지
              </label>
            </div>

            {error && (
              <div className="text-[var(--accent-warning)] text-sm p-3 bg-[var(--accent-warning)]/10 rounded-lg border border-[var(--accent-warning)]/20 flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <span className="truncate-1-line whitespace-normal leading-tight">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-lg transition-colors mt-2 shadow-[0_0_15px_rgba(0,255,204,0.3)]"
            >
              {loading ? '처리 중...' : (isLogin ? '로그인' : '계정 생성')}
            </button>
          </form>

          <div className="text-center text-sm text-[var(--text-secondary)] mt-6">
            {isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
            <button 
              onClick={() => {
                setIsLogin(!isLogin)
                setError(null)
              }} 
              type="button"
              className="ml-2 text-[var(--accent-secondary)] hover:text-white transition-colors font-medium hover:underline"
            >
              {isLogin ? '회원가입' : '로그인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
