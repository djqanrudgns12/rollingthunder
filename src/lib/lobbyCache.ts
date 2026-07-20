// userId로 스탬프된 로비 캐시 — 대기실 첫 페인트를 빠르게 하되 계정 간 잔여 데이터를 원천 차단.
//
// 안전 원칙:
//   · 신원 데이터(프로필·칩·인벤토리·장착)는 절대 zustand 자동 persist로 하이드레이트하지 않는다
//     (자동 하이드레이트는 세션 확인 전에 동기 실행되어 이전 계정 데이터가 잠깐 노출됨).
//   · 대신 이 캐시는 userId로 스탬프되고, read(userId)는 userId가 정확히 일치할 때만 값을 반환한다.
//   · 호출부(GlobalPlayerHUD)는 getSession()으로 현재 userId를 확인한 뒤에만 read를 호출한다
//     → 게스트/타계정에서는 read가 null을 반환하므로 잔여 데이터가 화면에 뜰 수 없다.
//   · 로그아웃/게스트 진입 시 clear로 완전 삭제한다.

import type { UserProfile } from '@/types/user';
import type { EquippedItems } from '@/store/inventoryStore';

const KEY = 'rt-lobby-cache';
const VERSION = 1 as const;

export interface LobbyCache {
  v: typeof VERSION;
  userId: string;
  profile: UserProfile;
  chips: number;
  inventory: string[];
  equipped: EquippedItems;
}

/** 현재 세션 userId와 스탬프가 일치하는 캐시만 반환. 불일치·손상·부재 시 null. */
export function readLobbyCache(expectedUserId: string): LobbyCache | null {
  if (typeof window === 'undefined' || !expectedUserId) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<LobbyCache>;
    if (c?.v !== VERSION || c.userId !== expectedUserId || !c.profile) return null;
    return c as LobbyCache;
  } catch {
    return null;
  }
}

export function writeLobbyCache(cache: Omit<LobbyCache, 'v'>): void {
  if (typeof window === 'undefined' || !cache.userId) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...cache }));
  } catch {
    // 용량 초과 등은 무시 — 캐시는 최적화용, 서버가 단일 진실원
  }
}

export function clearLobbyCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
