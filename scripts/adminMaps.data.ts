/**
 * Admin 커스텀 맵 10종 정의 (docs/PRD-new-obstacles.md PART 2)
 * ───────────────────────────────────────────────────────────────────────────
 * 신규 장애물 10종 + 기존 기물을 고루 활용한 완주 가능한 커스텀 맵.
 * scripts/validateAdminMaps.ts 로 헤드리스 검증, scripts/seedAdminMaps.ts 로 user_maps 삽입.
 *
 * 완주 보장 설계(§P2.3):
 *   - WORLD_WIDTH=800, 안전 x 60~740, 결승선 = worldHeight×0.98
 *   - backbone = 좌우 교대 경사 램프 사다리(ladder): 칩을 중앙 밴드(320~480)로
 *     지그재그 낙하시켜 벽에 붙지 않고 반드시 하강 → 어떤 wallStyle에서도 완주 가능
 *   - entry 퍼널(스폰 전폭→중앙) + exit 퍼널(중앙 게이트→결승), 하단 200px 장애물 금지
 *   - 신규 장애물은 대부분 센서/얇은 판이라 경로를 봉쇄하지 않고 궤적만 교란
 */
import type { EditorItem } from '../src/store/editorStore'

export interface AdminMapDef {
  key: string
  name: string
  description: string
  lengthType: 'Short' | 'Middle' | 'Long'
  complexity: 'Simple' | 'Medium' | 'Complex'
  worldHeight: number
  wallStyle: string
  bgImage: string
  themeWeights: Record<string, number>
  layoutConfig: { startLineY: number; endMarginPercent: number; spawnGap: number }
  items: EditorItem[]
}

const LC = { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 }
// 저작 맵은 밀도 주입을 우회하므로 themeWeights는 저장용 기본값(8개 키 합≈1).
const TW = { pin: 0.2, bumper: 0.2, booster: 0.15, portal: 0.05, blackhole: 0.05, whitehole: 0.05, hole: 0.05, windmill: 0.25 }

let _id = 0
const nid = (p: string) => `${p}_${_id++}`

/** 좌우 교대 경사 램프 사다리 — 완주 backbone. 중앙 밴드(320~480)로 지그재그 낙하. */
function ladder(prefix: string, yTop: number, yBottom: number, step: number, opts?: { w?: number; deg?: number; friction?: number }): EditorItem[] {
  const w = opts?.w ?? 360
  const deg = opts?.deg ?? 15
  const fr = opts?.friction ?? 0.08
  const out: EditorItem[] = []
  let i = 0
  for (let y = yTop; y <= yBottom; y += step) {
    const left = i % 2 === 0
    out.push({ id: nid(prefix), type: 'wall', x: left ? 300 : 500, y, w, h: 18, rotation: left ? deg : -deg, friction: fr })
    i++
  }
  return out
}

/** 스폰 전폭을 중앙 게이트(~120px)로 모으는 입구 퍼널. */
function entry(prefix: string, y = 205): EditorItem[] {
  return [
    { id: nid(prefix), type: 'wall', x: 190, y, w: 300, h: 18, rotation: 20, friction: 0.05 },
    { id: nid(prefix), type: 'wall', x: 610, y, w: 300, h: 18, rotation: -20, friction: 0.05 },
  ]
}

/** 중앙 게이트로 모아 결승선으로 떨어뜨리는 출구 퍼널(하단 200px는 비움). */
function exitFunnel(prefix: string, wh: number): EditorItem[] {
  const y = wh - 250
  return [
    { id: nid(prefix), type: 'wall', x: 190, y, w: 300, h: 18, rotation: 24, friction: 0.05 },
    { id: nid(prefix), type: 'wall', x: 610, y, w: 300, h: 18, rotation: -24, friction: 0.05 },
  ]
}

const startEnd = (wh: number): EditorItem[] => [
  { id: nid('start'), type: 'startline', x: 400, y: LC.startLineY },
  { id: nid('end'), type: 'endline', x: 400, y: Math.round(wh * (1 - LC.endMarginPercent)) },
]

// ───────────────────────────────────────────────────────────────────────────
// 맵 1) 컨베이어 물류창고 — conveyor·trapdoor·sticky + piston·핀·범퍼
const map1 = (): EditorItem[] => {
  const wh = 2800
  return [
    ...startEnd(wh), ...entry('m1'),
    ...ladder('m1', 440, wh - 380, 220, { deg: 16 }),
    // 벨트는 순방향·저속(측면으로 살짝 실어 나르되 정체 없이 흘려보냄)
    { id: nid('m1c'), type: 'conveyor', x: 400, y: 580, w: 180, h: 24, angle: 0, speed: 220 },
    { id: nid('m1c'), type: 'conveyor', x: 400, y: 1480, w: 180, h: 24, angle: 0, speed: 220 },
    // 함정문 1개(개폐 빠르게 — 오래 막히지 않게)
    { id: nid('m1t'), type: 'trapdoor', x: 400, y: 900, w: 150, h: 16, angle: 0, onFrames: 110, offFrames: 90 },
    // 점착은 가볍게(force 3) + 얇게
    { id: nid('m1s'), type: 'sticky', x: 400, y: 1180, w: 160, h: 80, force: 3 },
    { id: nid('m1p'), type: 'piston', x: 400, y: 2000, w: 120, h: 20, speed: 3, waypointB: { x: 260, y: 2000 } },
    { id: nid('m1b'), type: 'bumper', x: 320, y: 760, radius: 16, restitution: 1.5 },
    { id: nid('m1b'), type: 'bumper', x: 480, y: 1680, radius: 16, restitution: 1.5 },
    { id: nid('m1pn'), type: 'pin', x: 400, y: 480, radius: 9 },
    { id: nid('m1pn'), type: 'pin', x: 360, y: 1340, radius: 9 },
    { id: nid('m1pn'), type: 'pin', x: 440, y: 2260, radius: 9 },
    ...exitFunnel('m1', wh),
  ]
}

// 맵 2) 끈끈이 늪지대 — sticky·heavyg·mine + 범퍼·홀·벽
const map2 = (): EditorItem[] => {
  const wh = 2900
  return [
    ...startEnd(wh), ...entry('m2'),
    ...ladder('m2', 440, wh - 380, 220, { deg: 14 }),
    { id: nid('m2s'), type: 'sticky', x: 400, y: 560, w: 190, h: 90, force: 5 },
    { id: nid('m2s'), type: 'sticky', x: 380, y: 1300, w: 190, h: 100, force: 6 },
    { id: nid('m2s'), type: 'sticky', x: 420, y: 2020, w: 190, h: 90, force: 5 },
    { id: nid('m2h'), type: 'heavyg', x: 400, y: 880, w: 200, h: 150, force: 2.6 },
    { id: nid('m2m'), type: 'mine', x: 360, y: 1560, radius: 130, force: 6 },
    { id: nid('m2m'), type: 'mine', x: 440, y: 2200, radius: 120, force: 5 },
    { id: nid('m2bp'), type: 'bumper', x: 480, y: 720, radius: 17, restitution: 1.6 },
    { id: nid('m2bp'), type: 'bumper', x: 320, y: 1720, radius: 17, restitution: 1.6 },
    { id: nid('m2ho'), type: 'hole', x: 300, y: 1100, radius: 26 },
    { id: nid('m2pn'), type: 'pin', x: 420, y: 480, radius: 9 },
    { id: nid('m2pn'), type: 'pin', x: 380, y: 1900, radius: 9 },
    ...exitFunnel('m2', wh),
  ]
}

// 맵 3) 빙하 미끄럼 협곡 — icerink·conveyor·zerog + 핀·범퍼 (Short)
const map3 = (): EditorItem[] => {
  const wh = 2400
  // ladder 일부 rung을 빙판(icerink)으로 → 미끄럼 슬라이드 느낌 유지
  const rungs: EditorItem[] = []
  let i = 0
  for (let y = 440; y <= wh - 360; y += 200) {
    const left = i % 2 === 0
    const isIce = i % 2 === 1
    rungs.push({ id: nid('m3r'), type: isIce ? 'icerink' : 'wall', x: left ? 300 : 500, y, w: 340, h: 16, rotation: left ? 15 : -15, friction: isIce ? 0 : 0.08 })
    i++
  }
  return [
    ...startEnd(wh), ...entry('m3'),
    ...rungs,
    { id: nid('m3c'), type: 'conveyor', x: 400, y: 700, w: 200, h: 24, angle: 0, speed: 320 },
    { id: nid('m3c'), type: 'conveyor', x: 400, y: 1500, w: 200, h: 24, angle: 0, speed: -300 },
    { id: nid('m3z'), type: 'zerog', x: 400, y: 1120, w: 180, h: 150 },
    { id: nid('m3b'), type: 'bumper', x: 340, y: 900, radius: 16, restitution: 1.5 },
    { id: nid('m3b'), type: 'bumper', x: 460, y: 1720, radius: 16, restitution: 1.5 },
    { id: nid('m3pn'), type: 'pin', x: 400, y: 560, radius: 9 },
    { id: nid('m3pn'), type: 'pin', x: 360, y: 1320, radius: 9 },
    { id: nid('m3pn'), type: 'pin', x: 440, y: 1900, radius: 9 },
    ...exitFunnel('m3', wh),
  ]
}

// 맵 4) 무중력 우주정거장 — zerog·cannon·supernova + 포탈·부스터·범퍼 (wide, Long)
const map4 = (): EditorItem[] => {
  const wh = 3600
  return [
    ...startEnd(wh), ...entry('m4'),
    ...ladder('m4', 440, wh - 400, 250, { w: 380, deg: 14 }),
    { id: nid('m4z'), type: 'zerog', x: 400, y: 620, w: 220, h: 180 },
    { id: nid('m4z'), type: 'zerog', x: 400, y: 1680, w: 220, h: 180 },
    { id: nid('m4cn'), type: 'cannon', x: 400, y: 1040, angle: 180, power: 4 },
    { id: nid('m4cn'), type: 'cannon', x: 360, y: 2280, angle: 195, power: 5 },
    { id: nid('m4sn'), type: 'supernova', x: 400, y: 1380, radius: 200, force: 5, onFrames: 150, offFrames: 40 },
    { id: nid('m4sn'), type: 'supernova', x: 420, y: 2620, radius: 190, force: 5, onFrames: 140, offFrames: 40 },
    { id: nid('m4pt'), type: 'portal', x: 300, y: 1840, color: '#00e5ff' },
    { id: nid('m4pt'), type: 'portal', x: 520, y: 2440, color: '#00e5ff' },
    { id: nid('m4bo'), type: 'booster', x: 400, y: 900, power: 2, angle: 180 },
    { id: nid('m4b'), type: 'bumper', x: 320, y: 1200, radius: 17, restitution: 1.6 },
    { id: nid('m4b'), type: 'bumper', x: 480, y: 2000, radius: 17, restitution: 1.6 },
    { id: nid('m4b'), type: 'bumper', x: 400, y: 2900, radius: 17, restitution: 1.6 },
    ...exitFunnel('m4', wh),
  ]
}

// 맵 5) 폐허의 지뢰밭 — mine·trapdoor·heavyg + 범퍼·스피너·벽
const map5 = (): EditorItem[] => {
  const wh = 3000
  return [
    ...startEnd(wh), ...entry('m5'),
    ...ladder('m5', 440, wh - 380, 220),
    { id: nid('m5m'), type: 'mine', x: 380, y: 560, radius: 120, force: 5 },
    { id: nid('m5m'), type: 'mine', x: 420, y: 980, radius: 130, force: 6 },
    { id: nid('m5m'), type: 'mine', x: 360, y: 1620, radius: 120, force: 6 },
    { id: nid('m5m'), type: 'mine', x: 440, y: 2160, radius: 130, force: 6 },
    { id: nid('m5t'), type: 'trapdoor', x: 400, y: 760, w: 150, h: 16, angle: 0, onFrames: 140, offFrames: 90 },
    { id: nid('m5t'), type: 'trapdoor', x: 380, y: 1820, w: 150, h: 16, angle: 0, onFrames: 130, offFrames: 100 },
    { id: nid('m5hg'), type: 'heavyg', x: 400, y: 1240, w: 200, h: 150, force: 2.8 },
    { id: nid('m5sp'), type: 'spinner', x: 400, y: 2000, w: 150, h: 18, speed: 5 },
    { id: nid('m5b'), type: 'bumper', x: 320, y: 700, radius: 16, restitution: 1.6 },
    { id: nid('m5b'), type: 'bumper', x: 480, y: 1420, radius: 16, restitution: 1.6 },
    { id: nid('m5b'), type: 'bumper', x: 360, y: 2400, radius: 16, restitution: 1.6 },
    ...exitFunnel('m5', wh),
  ]
}

// 맵 6) 진자 시계탑 — pendulum·trapdoor·conveyor + 풍차·피스톤·벽 (hourglass, Long)
const map6 = (): EditorItem[] => {
  const wh = 3600
  return [
    ...startEnd(wh), ...entry('m6'),
    ...ladder('m6', 460, wh - 400, 250, { deg: 15 }),
    { id: nid('m6pd'), type: 'pendulum', x: 400, y: 620, length: 170, radius: 22, swingAngle: 55, speed: 2 },
    { id: nid('m6pd'), type: 'pendulum', x: 400, y: 1500, length: 150, radius: 22, swingAngle: 50, speed: 2.4 },
    { id: nid('m6pd'), type: 'pendulum', x: 400, y: 2500, length: 160, radius: 22, swingAngle: 55, speed: 2 },
    { id: nid('m6wm'), type: 'windmill', x: 400, y: 1050, w: 120, h: 12, speed: 4 },
    { id: nid('m6t'), type: 'trapdoor', x: 380, y: 850, w: 150, h: 16, angle: 0, onFrames: 150, offFrames: 90 },
    { id: nid('m6t'), type: 'trapdoor', x: 420, y: 2050, w: 150, h: 16, angle: 0, onFrames: 140, offFrames: 100 },
    { id: nid('m6c'), type: 'conveyor', x: 400, y: 2650, w: 200, h: 24, angle: 0, speed: 300 },
    { id: nid('m6ps'), type: 'piston', x: 400, y: 2850, w: 130, h: 20, speed: 3, waypointB: { x: 520, y: 2850 } },
    { id: nid('m6b'), type: 'bumper', x: 330, y: 1780, radius: 16, restitution: 1.5 },
    { id: nid('m6b'), type: 'bumper', x: 470, y: 2280, radius: 16, restitution: 1.5 },
    ...exitFunnel('m6', wh),
  ]
}

// 맵 7) 초신성 관측소 — supernova·cannon·zerog + 포탈·부스터·범퍼 (funnel, Long)
const map7 = (): EditorItem[] => {
  const wh = 3400
  return [
    ...startEnd(wh), ...entry('m7'),
    ...ladder('m7', 440, wh - 400, 240, { w: 340, deg: 15 }),
    { id: nid('m7sn'), type: 'supernova', x: 400, y: 640, radius: 190, force: 5, onFrames: 150, offFrames: 40 },
    { id: nid('m7sn'), type: 'supernova', x: 400, y: 1500, radius: 190, force: 5, onFrames: 140, offFrames: 40 },
    { id: nid('m7sn'), type: 'supernova', x: 400, y: 2340, radius: 180, force: 5, onFrames: 140, offFrames: 40 },
    { id: nid('m7cn'), type: 'cannon', x: 380, y: 1080, angle: 180, power: 4 },
    { id: nid('m7cn'), type: 'cannon', x: 420, y: 1920, angle: 175, power: 4 },
    { id: nid('m7z'), type: 'zerog', x: 400, y: 2000, w: 190, h: 160 },
    { id: nid('m7pt'), type: 'portal', x: 320, y: 1280, color: '#ff8a00' },
    { id: nid('m7pt'), type: 'portal', x: 480, y: 1700, color: '#ff8a00' },
    { id: nid('m7bo'), type: 'booster', x: 400, y: 860, power: 2, angle: 180 },
    { id: nid('m7b'), type: 'bumper', x: 340, y: 1680, radius: 16, restitution: 1.6 },
    { id: nid('m7b'), type: 'bumper', x: 460, y: 2560, radius: 16, restitution: 1.6 },
    ...exitFunnel('m7', wh),
  ]
}

// 맵 8) 사이버 사격장 — cannon·mine·icerink + 부스터·플리퍼·핀 (asymmetric)
const map8 = (): EditorItem[] => {
  const wh = 2900
  return [
    ...startEnd(wh), ...entry('m8'),
    ...ladder('m8', 440, wh - 380, 220, { w: 340 }),
    { id: nid('m8cn'), type: 'cannon', x: 380, y: 600, angle: 195, power: 5 },
    { id: nid('m8cn'), type: 'cannon', x: 420, y: 1440, angle: 165, power: 5 },
    { id: nid('m8m'), type: 'mine', x: 400, y: 920, radius: 130, force: 6 },
    { id: nid('m8m'), type: 'mine', x: 380, y: 1840, radius: 120, force: 6 },
    { id: nid('m8ir'), type: 'icerink', x: 400, y: 1120, w: 200, h: 16, angle: 10 },
    { id: nid('m8ir'), type: 'icerink', x: 400, y: 2080, w: 200, h: 16, angle: -10 },
    { id: nid('m8fl'), type: 'flipper', x: 320, y: 2200, length: 90, side: 'left', restAngle: 25, swingAngle: -35, swingSpeed: 30, returnSpeed: 8 },
    { id: nid('m8bo'), type: 'booster', x: 400, y: 760, power: 2, angle: 180 },
    { id: nid('m8pn'), type: 'pin', x: 360, y: 1240, radius: 9 },
    { id: nid('m8pn'), type: 'pin', x: 440, y: 1660, radius: 9 },
    { id: nid('m8b'), type: 'bumper', x: 460, y: 2000, radius: 16, restitution: 1.5 },
    ...exitFunnel('m8', wh),
  ]
}

// 맵 9) 중력 실험실 — heavyg·zerog·pendulum + 홀·스피너·벽 (narrow, x 130~670)
const map9 = (): EditorItem[] => {
  const wh = 2900
  // narrow: 내벽 100~700 → 램프 폭 축소, 중심 280/520
  const rungs: EditorItem[] = []
  let i = 0
  for (let y = 440; y <= wh - 380; y += 200) {
    const left = i % 2 === 0
    rungs.push({ id: nid('m9r'), type: 'wall', x: left ? 300 : 500, y, w: 300, h: 18, rotation: left ? 15 : -15, friction: 0.08 })
    i++
  }
  return [
    ...startEnd(wh),
    { id: nid('m9e'), type: 'wall', x: 250, y: 210, w: 240, h: 18, rotation: 20, friction: 0.05 },
    { id: nid('m9e'), type: 'wall', x: 550, y: 210, w: 240, h: 18, rotation: -20, friction: 0.05 },
    ...rungs,
    { id: nid('m9hg'), type: 'heavyg', x: 400, y: 600, w: 180, h: 150, force: 3 },
    { id: nid('m9hg'), type: 'heavyg', x: 400, y: 1600, w: 180, h: 150, force: 2.6 },
    { id: nid('m9z'), type: 'zerog', x: 400, y: 1000, w: 170, h: 160 },
    { id: nid('m9z'), type: 'zerog', x: 400, y: 2000, w: 170, h: 160 },
    { id: nid('m9pd'), type: 'pendulum', x: 400, y: 1300, length: 130, radius: 20, swingAngle: 45, speed: 2.2 },
    { id: nid('m9ho'), type: 'hole', x: 340, y: 820, radius: 24 },
    { id: nid('m9sp'), type: 'spinner', x: 400, y: 1850, w: 130, h: 16, speed: 5 },
    { id: nid('m9b'), type: 'bumper', x: 460, y: 1150, radius: 15, restitution: 1.5 },
    { id: nid('m9b'), type: 'bumper', x: 340, y: 2250, radius: 15, restitution: 1.5 },
    // narrow 출구 퍼널
    { id: nid('m9x'), type: 'wall', x: 250, y: wh - 250, w: 240, h: 18, rotation: 24, friction: 0.05 },
    { id: nid('m9x'), type: 'wall', x: 550, y: wh - 250, w: 240, h: 18, rotation: -24, friction: 0.05 },
  ]
}

// 맵 10) 혼돈의 대격변 — 신규 10종 전부 + 범퍼·포탈·풍차·부스터·플리퍼·블랙홀 (straight, Long)
const map10 = (): EditorItem[] => {
  const wh = 4000
  return [
    ...startEnd(wh), ...entry('m10'),
    ...ladder('m10', 440, wh - 400, 200),
    { id: nid('m10a'), type: 'conveyor', x: 400, y: 540, w: 200, h: 24, angle: 0, speed: 320 },
    { id: nid('m10a'), type: 'sticky', x: 400, y: 820, w: 180, h: 90, force: 5 },
    { id: nid('m10a'), type: 'icerink', x: 400, y: 1080, w: 200, h: 16, angle: 10 },
    { id: nid('m10a'), type: 'zerog', x: 400, y: 1360, w: 190, h: 160 },
    { id: nid('m10a'), type: 'heavyg', x: 400, y: 1680, w: 190, h: 150, force: 2.6 },
    { id: nid('m10a'), type: 'trapdoor', x: 400, y: 1980, w: 150, h: 16, angle: 0, onFrames: 140, offFrames: 90 },
    { id: nid('m10a'), type: 'mine', x: 380, y: 2280, radius: 130, force: 6 },
    { id: nid('m10a'), type: 'cannon', x: 400, y: 2580, angle: 180, power: 4 },
    { id: nid('m10a'), type: 'pendulum', x: 400, y: 2900, length: 160, radius: 22, swingAngle: 52, speed: 2.2 },
    { id: nid('m10a'), type: 'supernova', x: 400, y: 3240, radius: 200, force: 5, onFrames: 150, offFrames: 40 },
    // 기존 기물
    { id: nid('m10b'), type: 'bumper', x: 320, y: 680, radius: 16, restitution: 1.6 },
    { id: nid('m10b'), type: 'bumper', x: 480, y: 1500, radius: 16, restitution: 1.6 },
    { id: nid('m10b'), type: 'bumper', x: 360, y: 3060, radius: 16, restitution: 1.6 },
    { id: nid('m10wm'), type: 'windmill', x: 400, y: 960, w: 120, h: 12, speed: 4 },
    { id: nid('m10bh'), type: 'blackhole', x: 300, y: 1820, radius: 120, force: 3 },
    { id: nid('m10bo'), type: 'booster', x: 400, y: 2420, power: 2, angle: 180 },
    { id: nid('m10fl'), type: 'flipper', x: 460, y: 3120, length: 90, side: 'right', restAngle: 25, swingAngle: -35, swingSpeed: 30, returnSpeed: 8 },
    { id: nid('m10pt'), type: 'portal', x: 320, y: 2160, color: '#ff33aa' },
    { id: nid('m10pt'), type: 'portal', x: 500, y: 3400, color: '#ff33aa' },
    ...exitFunnel('m10', wh),
  ]
}

export const ADMIN_MAPS: AdminMapDef[] = [
  { key: 'conveyor_warehouse', name: '컨베이어 물류창고', description: '컨베이어 벨트와 개폐 함정문·점착 바닥이 칩을 층층이 실어 나르는 자동화 물류 라인.', lengthType: 'Middle', complexity: 'Simple', worldHeight: 2800, wallStyle: 'sawtooth', bgImage: '/images/assets/bg_steampunk_factory_1782785664737.jpg', themeWeights: TW, layoutConfig: LC, items: map1() },
  { key: 'sticky_bog', name: '끈끈이 늪지대', description: '점착 슬라임과 강화 중력이 발목을 잡고, 곳곳의 지뢰가 무리를 흩뜨리는 습지.', lengthType: 'Middle', complexity: 'Medium', worldHeight: 2900, wallStyle: 'wave', bgImage: '/images/assets/bg_bioluminescent_jungle_1782785780805.jpg', themeWeights: TW, layoutConfig: LC, items: map2() },
  { key: 'glacier_slide', name: '빙하 미끄럼 협곡', description: '마찰 없는 빙판과 컨베이어를 타고 무중력 구간을 미끄러져 내려가는 짧고 빠른 활강로.', lengthType: 'Short', complexity: 'Simple', worldHeight: 2400, wallStyle: 'diamond', bgImage: '/images/assets/bg_icy_glacier_cavern_1782785635405.jpg', themeWeights: TW, layoutConfig: LC, items: map3() },
  { key: 'zerog_station', name: '무중력 우주정거장', description: '무중력 홀에서 부유하다 캐논으로 발사되고, 주기적 초신성 충격파가 궤도를 흩뜨리는 정거장.', lengthType: 'Long', complexity: 'Complex', worldHeight: 3600, wallStyle: 'wide', bgImage: '/images/assets/bg_deep_space_nebula_1782785644285.jpg', themeWeights: TW, layoutConfig: LC, items: map4() },
  { key: 'ruins_minefield', name: '폐허의 지뢰밭', description: '연쇄 폭발하는 지뢰와 개폐 함정문·강화 중력이 매 순간 순위를 뒤엎는 파괴된 전장.', lengthType: 'Middle', complexity: 'Complex', worldHeight: 3000, wallStyle: 'zigzag', bgImage: '/images/assets/bg_post_apocalyptic_ruins_1782785753197.jpg', themeWeights: TW, layoutConfig: LC, items: map5() },
  { key: 'pendulum_clocktower', name: '진자 시계탑', description: '거대한 진자 파괴추와 풍차·개폐문이 맞물려 돌아가는 정밀 타이밍의 시계 장치.', lengthType: 'Long', complexity: 'Complex', worldHeight: 3600, wallStyle: 'hourglass', bgImage: '/images/assets/bg_celestial_clockwork.png', themeWeights: TW, layoutConfig: LC, items: map6() },
  { key: 'supernova_observatory', name: '초신성 관측소', description: '주기적 초신성 충격파와 캐논 발사, 무중력 구간이 교차하는 좁아지는 관측 통로.', lengthType: 'Long', complexity: 'Complex', worldHeight: 3400, wallStyle: 'funnel', bgImage: '/images/assets/bg_galactic_highway_1782785832121.jpg', themeWeights: TW, layoutConfig: LC, items: map7() },
  { key: 'cyber_range', name: '사이버 사격장', description: '캐논이 칩을 튕겨 보내고 지뢰와 빙판이 궤도를 뒤흔드는 비대칭 사이버 사격장.', lengthType: 'Middle', complexity: 'Medium', worldHeight: 2900, wallStyle: 'asymmetric', bgImage: '/images/assets/bg_cyber_dystopia.png', themeWeights: TW, layoutConfig: LC, items: map8() },
  { key: 'gravity_lab', name: '중력 실험실', description: '강화 중력과 무중력 존이 번갈아 놓이고 진자가 가로지르는 좁은 중력 실험 회랑.', lengthType: 'Middle', complexity: 'Medium', worldHeight: 2900, wallStyle: 'narrow', bgImage: '/images/assets/bg_virtual_matrix_grid_1782785744588.jpg', themeWeights: TW, layoutConfig: LC, items: map9() },
  { key: 'chaos_cataclysm', name: '혼돈의 대격변', description: '신규 장애물 10종이 총출동하고 블랙홀·포탈·풍차까지 뒤엉킨 최종 시련의 대격변.', lengthType: 'Long', complexity: 'Complex', worldHeight: 4000, wallStyle: 'straight', bgImage: '/images/assets/bg_abyssal_trench.png', themeWeights: TW, layoutConfig: LC, items: map10() },
]
