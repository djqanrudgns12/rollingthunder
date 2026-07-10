-- =============================================================
-- 019: 스킨 ID 정규화 — 기존 데이터 정리 마이그레이션
--
-- 배경:
--   포커칩 스킨이 특정 참가자에게 적용되지 않는 고질적 버그의 원인이
--   서버에 저장된 skinId 값의 비정규 형태(접두사 누락, 번호 없음 등)였음.
--   클라이언트 코드(skinUtils.ts)에서 런타임 정규화를 추가했지만,
--   DB에 남아있는 레거시 데이터도 한번 정리하여 정합성 보장.
--
-- 변경 사항:
--   1) user_current_roster.global_skin 값 정규화
--      - 'horse' → 'skin_horse' (skin_ 접두사 통일)
--      - 'spaceship' → 'skin_spaceship'
--   2) user_current_roster.participants JSONB 내 skinId 값 정규화
--      - 'chip_base' (번호 없음) → 정리 대상
--      - 'skin_chip_base' → 정리 대상
--      - skin_ 접두사가 붙은 채 저장된 skinId → 접두사 제거
--
-- ⚠️ 안전장치: 모든 UPDATE는 WHERE로 대상을 한정하여 불필요한 갱신 방지
-- =============================================================

-- 1. global_skin 값 정규화: 접두사 없이 저장된 기본 스킨에 skin_ 접두사 추가
UPDATE public.user_current_roster
SET global_skin = 'skin_horse',
    updated_at = NOW()
WHERE global_skin = 'horse';

UPDATE public.user_current_roster
SET global_skin = 'skin_spaceship',
    updated_at = NOW()
WHERE global_skin = 'spaceship';

-- 2. participants JSONB 내 skinId 정규화
-- 'chip_base' (번호 없음)를 'chip_base_1'로 보정
-- jsonb_array_elements + jsonb_set으로 배열 내 각 요소의 skinId를 순회하며 교체
UPDATE public.user_current_roster AS ucr
SET participants = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'skinId' IN ('chip_base', 'skin_chip_base')
        THEN jsonb_set(elem, '{skinId}', to_jsonb('chip_base_' || ((idx % 5) + 1)::text))
      WHEN elem->>'skinId' LIKE 'skin_%'
        THEN jsonb_set(elem, '{skinId}', to_jsonb(replace(elem->>'skinId', 'skin_', '')))
      ELSE elem
    END
  )
  FROM jsonb_array_elements(ucr.participants) WITH ORDINALITY AS arr(elem, idx)
),
updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(ucr.participants) AS elem
  WHERE elem->>'skinId' IN ('chip_base', 'skin_chip_base')
     OR (elem->>'skinId' LIKE 'skin_%' AND elem->>'skinId' != 'skin_chip_base')
);
