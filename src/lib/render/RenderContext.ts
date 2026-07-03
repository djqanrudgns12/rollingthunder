import * as PIXI from 'pixi.js'

/**
 * 게임(PhysicsCanvas)과 맵에디터(EditorCanvas)가 동일한 렌더링 코드를 공유하기 위한
 * 환경 의존성 주입 인터페이스.
 *
 * - 게임: app.ticker / tickers[] 일괄 해제, 항상 animated=true
 * - 에디터: 자체 ticker + 일시정지(animated 토글), 빈번한 add/remove → dispose 필수
 */
export interface RenderContext {
  /** 프리로드된 텍스처 조회 (없으면 Texture.from 폴백) */
  getTexture(url: string): PIXI.Texture
  /** 틱 콜백 등록 후 "해제 함수"를 반환 (누수 방지) */
  registerTicker(fn: (ticker: PIXI.Ticker) => void): () => void
  /** false면 정지 프레임 + 모션 가이드 오버레이로 렌더 (정밀 편집용) */
  animated: boolean
  /** 'lite'면 글로우 필터/트레일 등 고비용 이펙트 생략 (저줌/성능) */
  quality: 'full' | 'lite'
  /**
   * true면 이동/회전 기물(스피너·피스톤·풍차·플리퍼)의 위치·회전을 로컬 타이머로 구동하지 않는다.
   * 대신 워커의 실제 물리 트랜스폼(OBSTACLE_FRAME)이 매 프레임 노드에 반영된다 → 시각=콜라이더 일치.
   * 게임(PhysicsCanvas)만 true. 물리가 없는 에디터 미리보기는 undefined/false 로 두어 자체 애니메이션 유지.
   */
  physicsDriven?: boolean
}

/** PIXI.Application 으로부터 게임용 기본 RenderContext 생성 */
export function createAppRenderContext(
  app: PIXI.Application,
  opts: { animated?: boolean; quality?: 'full' | 'lite'; physicsDriven?: boolean } = {}
): RenderContext {
  return {
    getTexture: (url: string) => PIXI.Assets.get(url) || PIXI.Texture.from(url),
    registerTicker: (fn) => {
      app.ticker.add(fn)
      return () => {
        try { app.ticker.remove(fn) } catch {}
      }
    },
    animated: opts.animated ?? true,
    quality: opts.quality ?? 'full',
    physicsDriven: opts.physicsDriven ?? false,
  }
}
