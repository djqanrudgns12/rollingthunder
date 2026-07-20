-- 025_add_is_featured.sql
-- user_maps에 is_featured 컬럼 추가
-- 관리자가 특정 커스텀 맵을 "추천 맵"으로 지정할 수 있게 한다.
-- is_published(배포 상태)와 독립적으로 운영 — 추천은 배포된 맵 중에서만 의미가 있지만,
-- 추천 해제 후에도 배포 상태는 유지된다.

-- ============================================================
-- 1. is_featured 컬럼 추가
-- ============================================================
ALTER TABLE public.user_maps
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- 추천 맵만 빠르게 조회하기 위한 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_user_maps_featured
    ON public.user_maps(is_featured, created_at DESC)
    WHERE is_featured = true;

COMMENT ON COLUMN public.user_maps.is_featured
    IS '관리자가 지정하는 추천 맵 여부. is_published와 독립 운영.';
