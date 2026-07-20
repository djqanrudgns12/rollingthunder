// 인게임 텍스처 워밍업 — 대기실 첫 페인트를 막지 않는 백그라운드 프리로드.
// PhysicsCanvas는 레이스 시작 시 자체 목록을 다시 Assets.load 하므로(정합성 자체 보장),
// 이 모듈은 순수 캐시 예열용이다. 모듈 레벨 once-가드로 창당 1회만 실행된다.

const WARMUP_TEXTURES = [
  '/images/assets/chip_obsidian_gold.png',
  '/images/assets/chip_neon_plasma.png',
  '/images/assets/chip_cyber_hologram.png',
  '/images/assets/chip_liquid_mercury.png',
  '/images/assets/chip_crystal_prism.png',
  '/images/assets/bg_neon_synthwave_ultra.png',
  '/images/assets/bg_abyssal_trench.png',
  '/images/assets/bg_celestial_clockwork.png',
  '/images/assets/bg_cyber_dystopia.png',
  '/images/assets/brand_logo_masterpiece.png',
];

let warmupPromise: Promise<void> | null = null;

export function warmupGameAssets(): Promise<void> {
  if (!warmupPromise) {
    warmupPromise = (async () => {
      try {
        const PIXI = await import('pixi.js');
        await PIXI.Assets.load(WARMUP_TEXTURES);
      } catch {
        // 실패는 치명적이지 않다(레이스 진입 시 PhysicsCanvas가 재시도) — 다음 호출에서 재시도 허용
        warmupPromise = null;
      }
    })();
  }
  return warmupPromise;
}
