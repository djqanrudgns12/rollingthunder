'use server'

import { createClient } from '@/lib/supabase/server';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal';

/**
 * 현재 시행 중인 약관/처리방침 버전에 대한 동의 여부 확인.
 * 미로그인(게스트)은 동의 대상이 아니므로 needsReconsent: false.
 */
export async function getConsentStatusAction(): Promise<{ needsReconsent: boolean }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { needsReconsent: false };
    }

    const { data, error } = await supabase
      .from('user_consents')
      .select('doc_type')
      .eq('user_id', user.id)
      .or(`and(doc_type.eq.terms,version.eq.${TERMS_VERSION}),and(doc_type.eq.privacy,version.eq.${PRIVACY_VERSION})`);

    if (error) {
      // 조회 실패 시 게이트를 띄우지 않는다(오탐으로 이용을 막는 것보다 안전) — 다음 로드에서 재시도됨
      console.error('Error fetching consent status:', error);
      return { needsReconsent: false };
    }

    const agreed = new Set((data ?? []).map((row) => row.doc_type));
    return { needsReconsent: !(agreed.has('terms') && agreed.has('privacy')) };
  } catch (error) {
    console.error('Error in getConsentStatusAction:', error);
    return { needsReconsent: false };
  }
}

/**
 * 재동의 게이트에서 현재 버전 동의를 기록.
 * 버전은 클라이언트 입력을 받지 않고 서버(legal.ts)에서 결정한다.
 * UNIQUE(user_id, doc_type, version) + ignoreDuplicates로 멀티탭 경쟁에도 멱등.
 */
export async function recordConsentAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { error } = await supabase
      .from('user_consents')
      .upsert(
        [
          { user_id: user.id, doc_type: 'terms', version: TERMS_VERSION },
          { user_id: user.id, doc_type: 'privacy', version: PRIVACY_VERSION },
        ],
        { onConflict: 'user_id,doc_type,version', ignoreDuplicates: true }
      );

    if (error) {
      console.error('Error recording consent:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in recordConsentAction:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
