// PWA 설치 상태를 외부 스토어로 노출하는 모듈.
//
// beforeinstallprompt는 페이지 로드 초기(리액트 컴포넌트 마운트 전)에 발생할 수 있으므로,
// 컴포넌트 effect가 아닌 모듈 로드 시점에 리스너를 걸어 이벤트를 포획해 둔다.
// 컴포넌트는 useSyncExternalStore(subscribeInstallStatus, getInstallStatusSnapshot, ...)로 구독한다.
//
// 플랫폼별 동작:
// - Chrome/Edge (데스크톱·안드로이드): beforeinstallprompt 포획 → 네이티브 설치 프롬프트 표시
// - iOS/iPadOS: 이벤트 미지원 → 'manual' 상태로 두고 공유 메뉴 안내 가이드 표시
// - 기타(Firefox 등): 'manual' → 브라우저별 안내 가이드 표시

/** Chrome 계열 전용 비표준 이벤트 — 표준 타입 정의가 없어 직접 선언한다 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type InstallStatus =
  | 'unknown' // SSR/하이드레이션 직전
  | 'installed' // 이미 설치됨(standalone/fullscreen 실행 중이거나 이번 세션에 설치 완료)
  | 'available' // 네이티브 설치 프롬프트 사용 가능
  | 'manual' // 프롬프트 불가 — 플랫폼별 수동 안내 필요 (iOS 포함)

export type GuidePlatform = 'ios' | 'android' | 'desktop'

let deferredPrompt: BeforeInstallPromptEvent | null = null
let appInstalled = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
// 클릭 시점에 이벤트가 아직 도착하지 않은 경우를 위한 대기열 (waitForInstallPrompt)
const promptWaiters = new Set<(e: BeforeInstallPromptEvent | null) => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // 브라우저 기본 미니 인포바를 막고 우리 버튼에서 제어
    deferredPrompt = e as BeforeInstallPromptEvent
    promptWaiters.forEach((waiter) => waiter(deferredPrompt))
    promptWaiters.clear()
    emit()
  })
  window.addEventListener('appinstalled', () => {
    appInstalled = true
    deferredPrompt = null
    emit()
  })
}

/** 이 브라우저가 네이티브 설치 프롬프트 API를 지원하는지 (Chrome/Edge 계열) */
export function supportsNativePrompt(): boolean {
  return 'onbeforeinstallprompt' in window
}

/**
 * beforeinstallprompt가 아직 발행되지 않았다면 잠시 기다린다.
 * 크롬은 설치 가능성 판정 후 이벤트를 늦게 쏘는 경우가 있어, 클릭 직후의 공백을 메운다.
 * (사용자 제스처의 transient activation은 ~5초 유지되므로 이 대기 후에도 prompt() 호출이 유효하다)
 */
function waitForInstallPrompt(timeoutMs: number): Promise<BeforeInstallPromptEvent | null> {
  if (deferredPrompt) return Promise.resolve(deferredPrompt)
  if (!supportsNativePrompt()) return Promise.resolve(null)
  return new Promise((resolve) => {
    const waiter = (e: BeforeInstallPromptEvent | null) => {
      clearTimeout(timer)
      resolve(e)
    }
    const timer = setTimeout(() => {
      promptWaiters.delete(waiter)
      resolve(null)
    }, timeoutMs)
    promptWaiters.add(waiter)
  })
}

export function subscribeInstallStatus(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

export function getInstallStatusSnapshot(): InstallStatus {
  if (appInstalled) return 'installed'
  // 설치된 앱으로 실행 중인지 — manifest display가 fullscreen이므로 두 모드 모두 확인
  const nav = navigator as Navigator & { standalone?: boolean }
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true // iOS Safari 홈 화면 실행
  ) {
    return 'installed'
  }
  if (deferredPrompt) return 'available'
  return 'manual'
}

export const getInstallStatusServerSnapshot = (): InstallStatus => 'unknown'

/** 수동 안내 가이드에 쓸 플랫폼 판별 (클라이언트 전용) */
export function getGuidePlatform(): GuidePlatform {
  const ua = navigator.userAgent
  // iPadOS 13+는 UA가 Mac으로 위장하므로 터치 포인트로 구분
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/i.test(ua) || isIpadOs) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/**
 * 네이티브 설치 프롬프트를 표시한다.
 * 이벤트가 아직 도착하지 않았다면 최대 waitMs 동안 기다렸다가 띄운다.
 * 이벤트는 1회용이므로 사용 즉시 폐기한다(거절 시 브라우저가 조건에 따라 재발급).
 */
export async function promptInstall(waitMs = 1800): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const promptEvent = deferredPrompt ?? (await waitForInstallPrompt(waitMs))
  if (!promptEvent) return 'unavailable'
  deferredPrompt = null
  emit()
  await promptEvent.prompt()
  const { outcome } = await promptEvent.userChoice
  return outcome
}
