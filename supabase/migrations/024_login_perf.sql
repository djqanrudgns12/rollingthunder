-- 024_login_perf.sql
-- 로그인→대기실 성능 최적화 (docs 참조: 플랜 PART — 인게임 최적화)
-- 전체 멱등(재실행 안전): CREATE INDEX IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS + CREATE.
--
-- 내용:
--   1) 누락 인덱스 1건 (user_map_likes.map_id)
--   2) is_admin() 강화 — STABLE + search_path 고정 + uid 서브셀렉트
--   3) RLS 재작성 — 모든 정책의 auth.uid() / is_admin() 를 (select …) 형태로 감싸
--      per-row 재평가를 쿼리당 1회(InitPlan)로 전환. 행 가시성(semantics)은 완전 동일.
--      profiles 의 중복 permissive SELECT 2건(000 own / 014 admin)은 022 USING(true) TO authenticated
--      가 완전 상위집합이므로 제거 — anon 은 000/014 하에서도 0행(auth.uid() IS NULL)이라 전후 동일.
--   4) get_lobby_bootstrap() RPC — 로그인 시 profiles×3 + inventory + consent + stats(count×2)
--      분산 왕복(~8쿼리/3액션)을 단일 왕복으로 통합 (018 purchase_item_atomic 패턴).

-- ─────────────────────────────────────────────────────────────────────────
-- 1) 인덱스: user_map_likes 는 PK(user_id, map_id)라 map_id 단독 조회가 미지원이었다
--    (좋아요 수 집계·맵 삭제 CASCADE 경로).
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_map_likes_map_id ON public.user_map_likes(map_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) is_admin() 강화 (동작 동일: 현재 유저의 role='admin' 여부)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) RLS 재작성
--    규칙: 표현식은 원본과 동일하되 auth.uid() → (select auth.uid()),
--          public.is_admin() → (select public.is_admin()). TO 절은 원본 그대로 유지.
-- ─────────────────────────────────────────────────────────────────────────

-- profiles ───────────────────────────────────────────────────────────────
-- SELECT 통합: 022(USING true, TO authenticated)가 아래 두 정책의 완전 상위집합.
--   · anon: 000/014 모두 auth.uid() IS NULL → 0행 허용(제거 전후 동일).
--   · authenticated: 022가 전 행 허용(제거 전후 동일).
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
    ON public.profiles FOR UPDATE
    USING ((select public.is_admin()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);
-- (021의 컬럼 단위 GRANT는 건드리지 않음)

-- sessions ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sessions_insert_policy" ON public.sessions;
CREATE POLICY "sessions_insert_policy"
    ON public.sessions FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "sessions_update_policy" ON public.sessions;
CREATE POLICY "sessions_update_policy"
    ON public.sessions FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id);

-- maps ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "maps_insert_policy" ON public.maps;
CREATE POLICY "maps_insert_policy"
    ON public.maps FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "maps_update_policy" ON public.maps;
CREATE POLICY "maps_update_policy"
    ON public.maps FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role = 'admin'
        )
    );

-- map_edit_history ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert their own history" ON public.map_edit_history;
CREATE POLICY "Users can insert their own history"
    ON public.map_edit_history FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own history" ON public.map_edit_history;
CREATE POLICY "Users can view their own history"
    ON public.map_edit_history FOR SELECT
    USING ((select auth.uid()) = user_id);

-- chip_logs ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own chip logs" ON public.chip_logs;
CREATE POLICY "Users can view own chip logs"
    ON public.chip_logs FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all chip logs" ON public.chip_logs;
CREATE POLICY "Admins can view all chip logs"
    ON public.chip_logs FOR SELECT
    USING ((select public.is_admin()));

-- user_inventory ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own inventory" ON public.user_inventory;
CREATE POLICY "Users can view own inventory"
    ON public.user_inventory FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own inventory" ON public.user_inventory;
CREATE POLICY "Users can insert own inventory"
    ON public.user_inventory FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

-- user_missions ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own missions" ON public.user_missions;
CREATE POLICY "Users can view own missions"
    ON public.user_missions FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own missions" ON public.user_missions;
CREATE POLICY "Users can update own missions"
    ON public.user_missions FOR UPDATE
    USING ((select auth.uid()) = user_id);

-- user_achievements ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
CREATE POLICY "Users can view own achievements"
    ON public.user_achievements FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own achievements" ON public.user_achievements;
CREATE POLICY "Users can update own achievements"
    ON public.user_achievements FOR UPDATE
    USING ((select auth.uid()) = user_id);

-- user_current_roster ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_current_roster_select_policy" ON public.user_current_roster;
CREATE POLICY "user_current_roster_select_policy"
    ON public.user_current_roster FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_current_roster_insert_policy" ON public.user_current_roster;
CREATE POLICY "user_current_roster_insert_policy"
    ON public.user_current_roster FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_current_roster_update_policy" ON public.user_current_roster;
CREATE POLICY "user_current_roster_update_policy"
    ON public.user_current_roster FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_current_roster_delete_policy" ON public.user_current_roster;
CREATE POLICY "user_current_roster_delete_policy"
    ON public.user_current_roster FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- participant_lists ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "participant_lists_select_policy" ON public.participant_lists;
CREATE POLICY "participant_lists_select_policy"
    ON public.participant_lists FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "participant_lists_insert_policy" ON public.participant_lists;
CREATE POLICY "participant_lists_insert_policy"
    ON public.participant_lists FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "participant_lists_update_policy" ON public.participant_lists;
CREATE POLICY "participant_lists_update_policy"
    ON public.participant_lists FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "participant_lists_delete_policy" ON public.participant_lists;
CREATE POLICY "participant_lists_delete_policy"
    ON public.participant_lists FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- user_maps ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS user_maps_select ON public.user_maps;
CREATE POLICY user_maps_select ON public.user_maps FOR SELECT TO authenticated
    USING (owner_id = (select auth.uid()) OR is_published = true);

DROP POLICY IF EXISTS user_maps_insert ON public.user_maps;
CREATE POLICY user_maps_insert ON public.user_maps FOR INSERT TO authenticated
    WITH CHECK (
        owner_id = (select auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (select auth.uid()) AND role IN ('premium','admin')
        )
    );

DROP POLICY IF EXISTS user_maps_update ON public.user_maps;
CREATE POLICY user_maps_update ON public.user_maps FOR UPDATE TO authenticated
    USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS user_maps_delete ON public.user_maps;
CREATE POLICY user_maps_delete ON public.user_maps FOR DELETE TO authenticated
    USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS user_maps_admin_all ON public.user_maps;
CREATE POLICY user_maps_admin_all ON public.user_maps FOR ALL
    USING ((select public.is_admin()));

-- user_map_downloads ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS umd_select ON public.user_map_downloads;
CREATE POLICY umd_select ON public.user_map_downloads FOR SELECT TO authenticated
    USING (user_id = (select auth.uid()));

-- gacha_logs ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gacha_logs_select_own" ON public.gacha_logs;
CREATE POLICY "gacha_logs_select_own" ON public.gacha_logs
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "gacha_logs_insert_own" ON public.gacha_logs;
CREATE POLICY "gacha_logs_insert_own" ON public.gacha_logs
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- user_consents ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own consents" ON public.user_consents;
CREATE POLICY "Users can view own consents"
    ON public.user_consents FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own consents" ON public.user_consents;
CREATE POLICY "Users can insert own consents"
    ON public.user_consents FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all consents" ON public.user_consents;
CREATE POLICY "Admins can view all consents"
    ON public.user_consents FOR SELECT
    USING ((select public.is_admin()));

-- ─────────────────────────────────────────────────────────────────────────
-- 4) 로그인 부트스트랩 RPC — 단일 왕복으로 프로필/인벤토리/업적통계/재동의여부 반환.
--    약관 버전은 서버 코드(src/lib/legal.ts)가 단일 소스이므로 파라미터로 전달받는다.
--    반환 NULL = 미로그인 또는 프로필 없음(레거시 경로의 null 반환과 동일 의미).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lobby_bootstrap(p_terms_version TEXT, p_privacy_version TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_profile JSONB;
  v_inventory JSONB;
  v_total INTEGER;
  v_done INTEGER;
  v_needs BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(p) INTO v_profile FROM public.profiles p WHERE p.id = v_uid;
  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  -- fetchInventoryAction 과 동일: item_code 배열
  SELECT COALESCE(jsonb_agg(item_code), '[]'::jsonb) INTO v_inventory
    FROM public.user_inventory WHERE user_id = v_uid;

  -- getProfileStats 와 동일: 전체 업적 수 / 완료 업적 수 (정확 카운트)
  SELECT count(*)::int INTO v_total
    FROM public.missions WHERE type IN ('achievement', 'hidden');
  SELECT count(*)::int INTO v_done
    FROM public.user_achievements WHERE user_id = v_uid AND completed = true;

  -- getConsentStatusAction 과 동일: 시행 버전 terms+privacy 동의 이력 유무
  v_needs := NOT (
    EXISTS (SELECT 1 FROM public.user_consents
            WHERE user_id = v_uid AND doc_type = 'terms' AND version = p_terms_version)
    AND EXISTS (SELECT 1 FROM public.user_consents
            WHERE user_id = v_uid AND doc_type = 'privacy' AND version = p_privacy_version)
  );

  RETURN jsonb_build_object(
    'profile', v_profile,
    'inventory', v_inventory,
    'stats', jsonb_build_object(
      'total_achievements', v_total,
      'achievements_completed', v_done
    ),
    'needsReconsent', v_needs
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_lobby_bootstrap(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lobby_bootstrap(TEXT, TEXT) TO authenticated;
