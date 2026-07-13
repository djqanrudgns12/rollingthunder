-- 021_consent_tracking.sql
-- 약관/개인정보처리방침 동의 이력 저장 + profiles 본인 UPDATE 정책 복구
--
-- 포함 내용:
--   1. user_consents 테이블 (append-only 동의 이력) + RLS
--   2. profiles.settings 컬럼 보강 (기존에 마이그레이션 누락 — 수동 생성분 정합화)
--   3. handle_new_user() 재정의 — 3-way 병합:
--      016(게스트 칩/인벤토리/장착 승계) + 020(nickname) + 신규(동의 이력 기록)
--      ※ 020이 016의 게스트 승계 로직을 덮어써 파괴했던 회귀도 이 재정의로 복구된다.
--   4. profiles 본인 UPDATE RLS 정책 + 컬럼 단위 권한
--      (기존에는 관리자 UPDATE 정책(014)뿐이라 일반 유저의 settings/장착 저장이 무음 실패했음.
--       role/chips_balance는 컬럼 권한에서 제외해 권한 상승을 차단한다.)
--
-- 버전 갱신 절차: 약관/방침 본문 개정 시 src/lib/legal.ts 의 TERMS_VERSION/PRIVACY_VERSION을
-- 올리면, 이전 버전에만 동의한 회원은 다음 접속 시 재동의 게이트가 자동 발동한다.

-- ─────────────────────────────────────────────
-- 1. 동의 이력 테이블 (append-only)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('terms', 'privacy')),
    version TEXT NOT NULL,
    agreed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, doc_type, version)
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- 본인 동의 이력 조회
CREATE POLICY "Users can view own consents"
    ON public.user_consents FOR SELECT
    USING ( auth.uid() = user_id );

-- 본인 동의 기록 (재동의 게이트에서 INSERT)
CREATE POLICY "Users can insert own consents"
    ON public.user_consents FOR INSERT
    WITH CHECK ( auth.uid() = user_id );

-- 관리자 열람 (014 스타일)
CREATE POLICY "Admins can view all consents"
    ON public.user_consents FOR SELECT
    USING ( public.is_admin() );

-- UPDATE/DELETE 정책 없음 — 동의 이력은 수정·삭제 불가(append-only).
-- 회원 탈퇴 시에는 auth.users ON DELETE CASCADE로 함께 파기된다(처리방침 §4와 일관).

-- ─────────────────────────────────────────────
-- 2. profiles.settings 컬럼 정합화
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ─────────────────────────────────────────────
-- 3. handle_new_user() — 016 + 020 + 동의 기록 병합본
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_initial_chips BIGINT := 0;
    v_inventory JSONB;
    v_equipped JSONB;
    v_item_code TEXT;
    v_item_type TEXT;
BEGIN
    -- 1) 초기 칩 파싱 (게스트 시절 보유한 칩) — 016
    IF new.raw_user_meta_data ? 'guest_chips' THEN
        v_initial_chips := COALESCE((new.raw_user_meta_data->>'guest_chips')::BIGINT, 0);
    END IF;

    -- 2) 장착 아이템 파싱 — 016
    v_equipped := new.raw_user_meta_data->'guest_equipped';

    -- 3) profiles INSERT — 016 컬럼 + 020 nickname
    INSERT INTO public.profiles (
        id,
        username,
        name,
        nickname,
        role,
        chips_balance,
        total_earned_chips,
        equipped_skin,
        equipped_avatar,
        equipped_border,
        equipped_piece,
        equipped_background,
        equipped_frame
    )
    VALUES (
        new.id,
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'nickname',
        'user',
        v_initial_chips,
        v_initial_chips,
        v_equipped->>'skin',
        v_equipped->>'avatar',
        v_equipped->>'border',
        v_equipped->>'piece',
        v_equipped->>'background',
        v_equipped->>'frame'
    );

    -- 4) 게스트 인벤토리 승계 — 016
    IF new.raw_user_meta_data ? 'guest_inventory' THEN
        v_inventory := new.raw_user_meta_data->'guest_inventory';

        IF jsonb_typeof(v_inventory) = 'array' THEN
            FOR v_item_code IN SELECT * FROM jsonb_array_elements_text(v_inventory)
            LOOP
                v_item_type := split_part(v_item_code, '_', 1);

                INSERT INTO public.user_inventory (user_id, item_type, item_code)
                VALUES (new.id, v_item_type, v_item_code)
                ON CONFLICT (user_id, item_type, item_code) DO NOTHING;
            END LOOP;
        END IF;
    END IF;

    -- 5) 칩 연동 로그 — 016
    IF v_initial_chips > 0 THEN
        INSERT INTO public.chip_logs (user_id, amount, reason)
        VALUES (new.id, v_initial_chips, 'guest_sync');
    END IF;

    -- 6) 약관/처리방침 동의 이력 기록 — 신규.
    --    동의 기록 실패가 계정 생성을 중단시키지 않도록 예외를 삼킨다
    --    (누락 시 재동의 게이트가 다음 접속에서 받아낸다).
    BEGIN
        IF new.raw_user_meta_data ? 'terms_version' THEN
            INSERT INTO public.user_consents (user_id, doc_type, version)
            VALUES (new.id, 'terms', new.raw_user_meta_data->>'terms_version')
            ON CONFLICT (user_id, doc_type, version) DO NOTHING;
        END IF;

        IF new.raw_user_meta_data ? 'privacy_version' THEN
            INSERT INTO public.user_consents (user_id, doc_type, version)
            VALUES (new.id, 'privacy', new.raw_user_meta_data->>'privacy_version')
            ON CONFLICT (user_id, doc_type, version) DO NOTHING;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- 4. profiles 본인 UPDATE 복구 + 권한 상승 차단
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING ( auth.uid() = id )
    WITH CHECK ( auth.uid() = id );

-- 일반 유저가 갱신 가능한 컬럼을 화이트리스트로 제한한다.
-- role/chips_balance 등은 제외 → 본인 role 승격, 칩 직접 조작 불가.
-- (칩 변동은 SECURITY DEFINER RPC, 관리자 변경은 service_role 클라이언트 경유라 영향 없음.
--  ※ 이후 마이그레이션에서 클라이언트가 직접 수정할 profiles 컬럼을 추가하면 이 GRANT도 확장할 것.)
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (
    settings,
    equipped_skin,
    equipped_avatar,
    equipped_border,
    equipped_piece,
    equipped_background,
    equipped_frame
) ON public.profiles TO authenticated;
