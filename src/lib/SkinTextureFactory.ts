/**
 * SkinTextureFactory.ts
 * 
 * 왜 이렇게 만들었나:
 * skinDefinitions의 draw() 함수 결과를 PixiJS Texture로 변환하는 팩토리.
 * Canvas 2D → PIXI.Texture 변환 + 캐싱으로 동일 스킨 중복 생성 방지.
 * 
 * 흐름:
 * 1. skinId로 SKIN_DEFINITIONS에서 draw 함수를 찾음
 * 2. 오프스크린 Canvas에 흰색 실루엣을 그림
 * 3. Canvas → PIXI.Texture로 변환
 * 4. 캐시에 저장하여 재사용
 */

import * as PIXI from 'pixi.js';
import { SKIN_DEFINITIONS } from '@/data/skinDefinitions';

// 텍스처 캐시: skinId → PIXI.Texture
const textureCache = new Map<string, PIXI.Texture>();

/**
 * 기본/Normal 스킨의 벡터 텍스처를 생성하거나 캐시에서 반환
 * 
 * @param skinId - 스킨 키 (예: 'cat', 'horse', 'chip_base_1')
 * @param size - 텍스처 해상도 (기본 256px, 인게임 36px로 축소되므로 충분한 여유)
 * @returns PIXI.Texture | null (정의가 없는 스킨이면 null 반환)
 */
export function getSkinTexture(skinId: string, size: number = 256): PIXI.Texture | null {
  // 캐시 히트 — 이미 생성된 텍스처 즉시 반환
  const cacheKey = `${skinId}_${size}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  // skinDefinitions에서 해당 스킨 찾기
  const def = SKIN_DEFINITIONS[skinId];
  if (!def) {
    // 정의되지 않은 스킨 (pr_ 프리미엄 등) → null 반환하여 기존 PNG 로직으로 폴백
    return null;
  }

  // 오프스크린 캔버스 생성
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 투명 배경에서 시작 (Canvas는 기본이 투명)
  ctx.clearRect(0, 0, size, size);

  // 캔버스 중앙으로 좌표 원점 이동 — draw 함수는 (0,0) 기준으로 그림
  ctx.translate(size / 2, size / 2);

  // 스케일 적용 (기본 1.0)
  const scale = def.scale ?? 1.0;
  if (scale !== 1.0) {
    ctx.scale(scale, scale);
  }

  // 기본 채움색을 흰색으로 설정 — tint 시스템이 이 흰색을 참가자 색으로 치환
  ctx.fillStyle = 'white';

  // draw 함수 호출하여 실루엣 그리기
  const radius = size / 2;
  def.draw(ctx, radius);

  // Canvas → PIXI.Texture 변환
  const texture = PIXI.Texture.from(canvas);

  // 캐시에 저장
  textureCache.set(cacheKey, texture);

  return texture;
}

/**
 * 특정 skinId가 벡터 기반 스킨인지 확인
 * (SKIN_DEFINITIONS에 정의되어 있으면 벡터, 아니면 기존 PNG)
 */
export function isVectorSkin(skinId: string): boolean {
  return skinId in SKIN_DEFINITIONS;
}

/**
 * 특정 skinId가 회전해야 하는 스킨인지 확인
 * skinDefinitions의 spin 속성을 반환 (없으면 false)
 */
export function shouldSpin(skinId: string): boolean {
  return SKIN_DEFINITIONS[skinId]?.spin ?? false;
}

/**
 * 캐시 초기화 (메모리 해제용, 보통 사용할 일 없음)
 */
export function clearSkinCache(): void {
  textureCache.forEach((tex) => tex.destroy(true));
  textureCache.clear();
}
