/**
 * 맵 검증 공유 타입/상수 (워커 · UI · 러너 공유).
 * 사이드이펙트 없음 — SimulationCore/PIXI/React import 금지.
 */
import type { EditorItem } from '@/store/editorStore'

export interface HeatmapData { cols: number; rows: number; cell: number; grid: number[]; max: number }
export interface CheckRow { label: string; ok: boolean; value: string; target: string }
export interface ValidationResult {
  races: number; chips: number
  medianFinish: number; p10: number; p90: number; avgSpeed: number
  fairness: number; edgePct: number
  gravityStorms: number; timedOutRaces: number; avgLeadChanges: number
  avgGimmickRate: number; deadGimmicks: { type: string; count: number }[]
  stuckSamples: { x: number; y: number }[]
  heatmap: HeatmapData
  checks: CheckRow[]
}
export interface ValidationConfig {
  items: EditorItem[]; worldHeight: number; wallStyle: string
  layoutConfig?: any; races?: number; chips?: number
  comebackStrength?: number; playTime?: number
}

/** 지표 합격 임계값(단일 소스). 계산식은 validationRunner 내부에 있고 여기선 경계값만 상수화. */
export const VALIDATION_THRESHOLDS = {
  finishTime: { min: 45, max: 70 }, // 완주시간 중앙값(초)
  fairness: { max: 0.25 },          // |pearson(스폰x, 순위)|
  edgeHugging: { maxPct: 12 },      // 엣지허깅 칩 비율(%)
  leadChanges: { min: 3 },          // 레이스당 선두 교체 평균
  deadGimmickRate: 0.15,            // 적중률 이 값 미만이면 "죽은 기믹"
} as const

/** 검증 패널 지표 라벨/설명 카피. checks[i].label 을 키로 매칭. */
export const METRIC_INFO: Record<string, { tooltip: string }> = {
  '완주시간(중앙)': { tooltip: '칩 절반이 완주하는 데 걸리는 시간. 45~70초가 시청 몰입에 적정합니다. 짧으면 기물을 늘리거나 맵을 연장하고, 길면 병목을 제거하세요.' },
  '공정성': { tooltip: '출발 위치(가로)와 최종 순위의 상관관계. 0.25 이상이면 특정 출발 자리가 유리한 맵입니다. 좌우 대칭 배치로 완화하세요.' },
  '엣지허깅': { tooltip: '경기의 절반 이상을 측벽에 붙어 내려간 칩 비율. 높으면 벽 쪽이 지름길입니다 — 벽 근처에 핀/범퍼를 배치하세요.' },
  '정체(스톰/미완주)': { tooltip: '중력폭풍(장기 정체 구제) 발동 횟수 / 제한시간(4분) 내 미완주 레이스 수. 0이 아니면 칩이 갇히는 지형이 있습니다 — 히트맵의 빨간 지점을 확인하세요.' },
  '박진감(선두교체)': { tooltip: '레이스당 1위가 바뀐 평균 횟수. 3회 미만이면 초반에 승부가 굳는 단조로운 맵입니다.' },
  '기믹적중': { tooltip: '각 기믹(풍차·부스터·포탈 등)을 통과한 칩 비율. 15% 미만인 "죽은 기믹"은 위치를 조정하거나 제거하세요.' },
}

// ── 워커 메시지 프로토콜 ──
export type ValidationHostMsg =
  | { type: 'RUN'; payload: { config: ValidationConfig } }
  | { type: 'CANCEL' }

export type ValidationWorkerMsg =
  | { type: 'PROGRESS'; payload: { race: number; races: number; pct: number } }
  | { type: 'RESULT'; payload: ValidationResult }
  | { type: 'ERROR'; payload: { message: string } }
