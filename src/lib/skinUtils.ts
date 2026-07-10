/**
 * skinUtils.ts — 스킨 ID 정규화 유틸리티 (Single Source of Truth)
 *
 * 모든 skinId 변환은 이 파일을 통해서만 수행.
 * 상점 item_id → SKIN_DEFINITIONS key 변환의 유일한 진입점.
 *
 * 왜 이 파일이 필요한가:
 * skinId 정규화 로직이 Dashboard, PhysicsCanvas, useRosterSync 등 7+ 곳에 분산되어 있었고,
 * 어느 한 곳이라도 정규화를 누락하면 SKIN_DEFINITIONS에서 키를 찾지 못해
 * 특정 참가자에게 스킨이 적용되지 않는 고질적 버그가 반복 발생했음.
 *
 * 환경: TypeScript 5 / Next.js 15 / Zustand 5
 */

import { SKIN_DEFINITIONS } from '@/data/skinDefinitions'

/** chip_base 변형 번호 범위 (1~5) */
const CHIP_VARIANT_COUNT = 5 as const

/** 레거시 가챠 접두사 패턴 (UR_, SR_, SSR_, R_, N_) */
const LEGACY_PREFIX_RE = /^(?:UR|SR|SSR|R|N)_/

/** chip_base 변형 패턴 (chip_base_1 ~ chip_base_5) */
const CHIP_VARIANT_RE = /^chip_base_[1-5]$/

/**
 * 어떤 형태의 skinId든 SKIN_DEFINITIONS에서 찾을 수 있는
 * 정규화된 키로 변환합니다.
 *
 * @example
 * normalizeSkinId('skin_chip_base') // → null (변형 배정 필요)
 * normalizeSkinId('skin_cat')       // → 'cat'
 * normalizeSkinId('skin_pr_dragon') // → 'pr_dragon'
 * normalizeSkinId('UR_blackhole')   // → 'blackhole'
 * normalizeSkinId('SR_cat')         // → 'cat'
 * normalizeSkinId('chip_base_3')    // → 'chip_base_3'
 * normalizeSkinId(undefined)        // → null
 */
export function normalizeSkinId(rawId: string | undefined | null): string | null {
  if (!rawId) return null

  // 'skin_' 접두사 → 레거시 가챠 접두사 순서로 제거
  const key = rawId.replace(/^skin_/, '').replace(LEGACY_PREFIX_RE, '')

  // 'chip_base' (번호 없음)는 유효한 SKIN_DEFINITIONS 키가 아님
  if (key === 'chip_base') return null

  // SKIN_DEFINITIONS에 등록된 벡터 스킨
  if (key in SKIN_DEFINITIONS) return key

  // 프리미엄 스킨 (pr_*) — SKIN_DEFINITIONS에는 없지만 PNG 에셋 있음
  if (key.startsWith('pr_')) return key

  // 알 수 없는 키
  return null
}

/**
 * globalSkin 값이 포커칩(chip_base) 계열인지 판별
 */
export function isChipBaseSkin(globalSkin: string | undefined | null): boolean {
  if (!globalSkin) return true // 기본값이 포커칩
  const clean = globalSkin.replace(/^skin_/, '')
  return clean === 'chip_base' || CHIP_VARIANT_RE.test(clean)
}

/**
 * 포커칩 스킨일 때 참가자별 변형(1~5)을 배정.
 * 기존에 유효한 chip_base_N이 있으면 유지, 없으면 인덱스 기반 결정적 배정.
 */
export function assignChipVariant(
  existingSkinId: string | undefined | null,
  index: number,
): string {
  if (existingSkinId && CHIP_VARIANT_RE.test(existingSkinId)) {
    return existingSkinId
  }
  return `chip_base_${(index % CHIP_VARIANT_COUNT) + 1}`
}

/**
 * globalSkin과 참가자 인덱스를 받아 최종 skinId를 결정.
 *
 * - 포커칩 계열 → chip_base_N 변형 배정
 * - 기타 → 정규화된 skinId 반환
 * - 모든 실패 케이스 → chip_base_1 (안전한 기본값)
 */
export function resolveSkinId(
  globalSkin: string | undefined | null,
  existingSkinId: string | undefined | null,
  index: number,
): string {
  if (isChipBaseSkin(globalSkin)) {
    return assignChipVariant(existingSkinId, index)
  }
  return normalizeSkinId(globalSkin) ?? 'chip_base_1'
}
