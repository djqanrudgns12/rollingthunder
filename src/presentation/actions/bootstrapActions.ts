'use server'

import { createClient } from '@/lib/supabase/server';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal';
import type { UserProfile } from '@/types/user';
import type { EquippedItems } from '@/store/inventoryStore';
import { getProfileOverviewAction } from './profileActions';
import { getConsentStatusAction } from './consentActions';
import { fetchInventoryAction } from '@/app/actions/inventory';

export interface LobbyBootstrap {
  profile: UserProfile;
  inventory: string[];
  equipped: EquippedItems;
  needsReconsent: boolean;
}

const EMPTY_EQUIPPED: EquippedItems = {
  skin: null, avatar: null, border: null, piece: null, background: null, frame: null,
};

/**
 * 로그인 부트스트랩 — 대기실 진입에 필요한 프로필/인벤토리/업적통계/재동의여부를
 * 단일 왕복(RPC get_lobby_bootstrap, 024 마이그레이션)으로 조회한다.
 * 기존 경로는 3개 액션(getProfileOverview/getConsentStatus/fetchInventory)에 걸쳐
 * getUser 3회 + 쿼리 ~8회를 순차/부분병렬로 수행했다.
 *
 * RPC 미존재(마이그레이션 미적용)·오류 시에는 레거시 3액션 병렬 폴백으로
 * 동일한 결과를 만들어 기능 저하가 없다(graceful degradation).
 */
export async function getLobbyBootstrapAction(): Promise<LobbyBootstrap | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return null;

    const { data, error } = await supabase.rpc('get_lobby_bootstrap', {
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
    });

    if (error) {
      // PGRST202(함수 없음) 포함 모든 RPC 오류 → 레거시 경로 (안전 우선)
      return legacyBootstrap();
    }
    if (!data) {
      // RPC가 NULL 반환 = 프로필 없음(레거시의 profile null과 동일 의미)
      return null;
    }

    const p = (data.profile ?? {}) as Record<string, unknown>;
    const stats = (data.stats ?? {}) as Record<string, unknown>;

    // getProfileOverviewAction과 동일한 필드 매핑(값 비트 동일 보장)
    const profile = {
      ...p,
      email: user.email,
      chips_balance: Number((p as any).chips ?? (p as any).chips_balance ?? 0),
      total_games_played: Number((p as any).total_games_played ?? 0),
      login_count: Number((p as any).login_count ?? 0),
      total_achievements: Number(stats.total_achievements ?? 0),
      achievements_completed: Number(stats.achievements_completed ?? 0),
    } as UserProfile;

    // fetchInventoryAction과 동일: equipped_*는 같은 profiles 행에서 파생
    const equipped: EquippedItems = {
      skin: ((p as any).equipped_skin as string) || null,
      avatar: ((p as any).equipped_avatar as string) || null,
      border: ((p as any).equipped_border as string) || null,
      piece: ((p as any).equipped_piece as string) || null,
      background: ((p as any).equipped_background as string) || null,
      frame: ((p as any).equipped_frame as string) || null,
    };

    return {
      profile,
      inventory: Array.isArray(data.inventory) ? (data.inventory as string[]) : [],
      equipped,
      needsReconsent: !!data.needsReconsent,
    };
  } catch (e) {
    console.error('[getLobbyBootstrapAction]', e);
    try { return await legacyBootstrap(); } catch { return null; }
  }
}

/** 024 미적용 환경 폴백 — 기존 3액션을 병렬 실행해 동일한 형태로 정규화 */
async function legacyBootstrap(): Promise<LobbyBootstrap | null> {
  const [profile, consent, inv] = await Promise.all([
    getProfileOverviewAction(),
    getConsentStatusAction(),
    fetchInventoryAction(),
  ]);
  if (!profile) return null;
  return {
    profile,
    inventory: inv?.success && inv.inventory ? inv.inventory : [],
    equipped: inv?.success && inv.equipped ? inv.equipped : EMPTY_EQUIPPED,
    needsReconsent: consent.needsReconsent,
  };
}
