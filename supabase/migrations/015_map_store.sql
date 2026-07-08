-- 015_map_store.sql
-- 커스텀 맵 스토어: premium 개인 맵(user_maps), 다운로드 스냅샷, 좋아요, 칩 이전 경제
-- 정책: 배포는 premium/admin + 검증 통과 시 자동 공개.
--       다운로드는 100칩 소모(최초 1회, 셀프 제외) → 전액 제작자에게 이전(시스템 발행 없음).
--       premium 저장 슬롯 10개(admin 무제한).

-- ============================================================
-- 1. user_maps: 개인 커스텀 맵 + 스토어 배포 상태
--    (공식맵 테이블 maps는 admin 전용으로 무변경 유지 — 권한 모델을 테이블 경계로 분리)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
    description TEXT DEFAULT '',
    length_type TEXT NOT NULL DEFAULT 'Middle'
        CHECK (length_type IN ('Short','Middle','Long')),
    complexity TEXT NOT NULL DEFAULT 'Medium'
        CHECK (complexity IN ('Simple','Medium','Complex')),
    world_height INTEGER DEFAULT 2400,
    wall_style TEXT DEFAULT 'straight',
    bg_image TEXT,
    theme_weights JSONB DEFAULT '{}'::jsonb,
    layout_config JSONB DEFAULT '{}'::jsonb,
    items JSONB DEFAULT '[]'::jsonb,
    schema_version INTEGER NOT NULL DEFAULT 1,   -- EditorItem 스키마 진화 대비
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    validation_summary JSONB,                    -- 클라이언트 헤드리스 시뮬 ValidationResult 요약
    validated_at TIMESTAMPTZ,
    download_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_maps_owner ON public.user_maps(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_maps_store
    ON public.user_maps(is_published, download_count DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_user_maps_store_recent
    ON public.user_maps(is_published, published_at DESC) WHERE is_published = true;

-- ============================================================
-- 2. user_map_downloads: 다운로드 = 스냅샷 복사
--    원본이 삭제/수정돼도 다운로더는 영향 없음 (비정규화 + snapshot JSONB)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_map_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_map_id UUID REFERENCES public.user_maps(id) ON DELETE SET NULL,
    map_name TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    downloaded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, source_map_id)   -- 유저당 맵 1회 → 중복 과금/보상 원천 차단
);

CREATE INDEX IF NOT EXISTS idx_umd_user
    ON public.user_map_downloads(user_id, downloaded_at DESC);

-- ============================================================
-- 3. user_map_likes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_map_likes (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    map_id UUID NOT NULL REFERENCES public.user_maps(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, map_id)
);

-- ============================================================
-- 4. 저장 슬롯 제한 트리거 (DB가 최종 권위, UseCase는 친절한 사전 체크)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_user_map_slot_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
    v_count INTEGER;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = NEW.owner_id;
    IF v_role = 'admin' THEN
        RETURN NEW;   -- admin 무제한
    END IF;
    SELECT count(*) INTO v_count FROM public.user_maps WHERE owner_id = NEW.owner_id;
    IF v_count >= 10 THEN
        RAISE EXCEPTION 'MAP_SLOT_LIMIT: 개인 맵은 최대 10개까지 저장할 수 있습니다.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_map_slot_limit ON public.user_maps;
CREATE TRIGGER trg_user_map_slot_limit
    BEFORE INSERT ON public.user_maps
    FOR EACH ROW EXECUTE FUNCTION public.enforce_user_map_slot_limit();

-- ============================================================
-- 5. updated_at 자동 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_user_maps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_maps_touch ON public.user_maps;
CREATE TRIGGER trg_user_maps_touch
    BEFORE UPDATE ON public.user_maps
    FOR EACH ROW EXECUTE FUNCTION public.touch_user_maps_updated_at();

-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE public.user_maps ENABLE ROW LEVEL SECURITY;

-- 본인 소유 OR 배포된 맵 (스토어 열람은 로그인 유저만)
CREATE POLICY user_maps_select ON public.user_maps FOR SELECT TO authenticated
    USING (owner_id = auth.uid() OR is_published = true);

-- 본인 소유 + premium/admin 역할만 저장 가능
CREATE POLICY user_maps_insert ON public.user_maps FOR INSERT TO authenticated
    WITH CHECK (
        owner_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('premium','admin')
        )
    );

CREATE POLICY user_maps_update ON public.user_maps FOR UPDATE TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY user_maps_delete ON public.user_maps FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- 관리자 전체 접근 (014_admin_policies의 is_admin() 재사용)
CREATE POLICY user_maps_admin_all ON public.user_maps FOR ALL
    USING (public.is_admin());

ALTER TABLE public.user_map_downloads ENABLE ROW LEVEL SECURITY;

-- 본인 다운로드 목록만 조회. INSERT는 download_user_map RPC(SECURITY DEFINER) 경유만.
CREATE POLICY umd_select ON public.user_map_downloads FOR SELECT TO authenticated
    USING (user_id = auth.uid());

ALTER TABLE public.user_map_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY uml_select ON public.user_map_likes FOR SELECT TO authenticated
    USING (true);   -- 좋아요 여부 표시용 (쓰기는 RPC 경유만)

-- ============================================================
-- 7. download_user_map RPC — 원자적 다운로드 + 칩 이전
--    다운로더 100칩 차감 → 제작자 100칩 지급 (P2P 이전, 시스템 발행 없음)
--    deduct_chips가 잔액 부족 시 RAISE EXCEPTION → 전체 롤백(스냅샷 미기록) 보장
-- ============================================================
CREATE OR REPLACE FUNCTION public.download_user_map(p_map_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_map RECORD;
    v_creator_name TEXT;
    v_snapshot JSONB;
    v_rows INTEGER := 0;
    v_new_balance BIGINT := NULL;
    v_download_cost CONSTANT BIGINT := 100;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;

    SELECT * INTO v_map FROM public.user_maps
    WHERE id = p_map_id AND is_published = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MAP_NOT_FOUND';
    END IF;

    SELECT COALESCE(name, username, '알 수 없음') INTO v_creator_name
    FROM public.profiles WHERE id = v_map.owner_id;

    v_snapshot := jsonb_build_object(
        'schemaVersion', v_map.schema_version,
        'items',        v_map.items,
        'worldHeight',  v_map.world_height,
        'wallStyle',    v_map.wall_style,
        'bgImage',      v_map.bg_image,
        'layoutConfig', v_map.layout_config,
        'themeWeights', v_map.theme_weights,
        'lengthType',   v_map.length_type,
        'complexity',   v_map.complexity,
        'description',  v_map.description
    );

    INSERT INTO public.user_map_downloads
        (user_id, source_map_id, map_name, creator_name, snapshot)
    VALUES (auth.uid(), p_map_id, v_map.name, v_creator_name, v_snapshot)
    ON CONFLICT (user_id, source_map_id) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    -- 최초 다운로드 && 본인 맵 아님 → 과금/보상/카운트 (재다운로드·셀프는 전부 스킵)
    IF v_rows > 0 AND v_map.owner_id <> auth.uid() THEN
        v_new_balance := public.deduct_chips(auth.uid(), v_download_cost,
                                             'map_download_' || p_map_id::text);
        UPDATE public.user_maps
        SET download_count = download_count + 1
        WHERE id = p_map_id;
        PERFORM public.add_chips(v_map.owner_id, v_download_cost,
                                 'map_download_reward_' || p_map_id::text);
    END IF;

    RETURN jsonb_build_object(
        'name',          v_map.name,
        'creatorName',   v_creator_name,
        'snapshot',      v_snapshot,
        'firstDownload', v_rows > 0,
        'charged',       v_rows > 0 AND v_map.owner_id <> auth.uid(),
        'newBalance',    v_new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. toggle_user_map_like RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_user_map_like(p_map_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_liked BOOLEAN;
    v_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_maps WHERE id = p_map_id AND is_published = true) THEN
        RAISE EXCEPTION 'MAP_NOT_FOUND';
    END IF;

    DELETE FROM public.user_map_likes
    WHERE user_id = auth.uid() AND map_id = p_map_id;

    IF FOUND THEN
        v_liked := false;
        UPDATE public.user_maps SET like_count = GREATEST(like_count - 1, 0)
        WHERE id = p_map_id RETURNING like_count INTO v_count;
    ELSE
        INSERT INTO public.user_map_likes (user_id, map_id)
        VALUES (auth.uid(), p_map_id);
        v_liked := true;
        UPDATE public.user_maps SET like_count = like_count + 1
        WHERE id = p_map_id RETURNING like_count INTO v_count;
    END IF;

    RETURN jsonb_build_object('liked', v_liked, 'likeCount', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. 알려진 리스크 (허용)
-- - 검증(validation_summary)은 클라이언트 제출 기반 — 조작 가능하나 피해는
--   "저품질 맵 노출" 수준. 서버 재시뮬(scripts/simulate.ts 로직의 Node 러너)은 후속 과제.
-- - 다운로드가 100칩 유료(칩 이전)이므로 다계정 파밍 유인은 낮음(시스템 총량 불변).
-- ============================================================
