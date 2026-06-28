/**
 * 맵 와이어프레임 렌더러
 * 각 MapPresets 맵을 상단뷰 ASCII 도식으로 그려, 실제 구조/형태를 한눈에 비교한다.
 * 실행: npx tsx scripts/wireframe.ts [mapKey]
 */
import { MapPresets } from '../src/engine/MapPresets';

const COLS = 58;            // x: 0..800
const PX_PER_ROW = 52;      // y 1행 = 52px

const X0 = 0, X1 = 800;
const colOf = (x: number) => Math.round(((x - X0) / (X1 - X0)) * (COLS - 1));

function glyph(type: string): string {
  switch (type) {
    case 'pin': return '.';
    case 'bumper': return 'o';
    case 'booster': return '^';
    case 'windmill': return '*';
    case 'portal': return 'O';
    case 'blackhole': return '@';
    case 'whitehole': return '&';
    case 'hole': return 'V';
    case 'piston': return 'H';
    default: return '#';
  }
}

function plot(grid: string[][], r: number, c: number, ch: string) {
  if (r < 0 || r >= grid.length || c < 0 || c >= COLS) return;
  // 우선순위: 기물 > 벽선. 이미 기물이면 덮어쓰지 않음(점 제외)
  const cur = grid[r][c];
  if (cur !== ' ' && '^*O@&VH#o'.includes(cur)) return;
  grid[r][c] = ch;
}

function rasterWall(grid: string[][], item: any) {
  const w = item.w || 100;
  const rad = ((item.rotation || 0) * Math.PI) / 180;
  const hx = Math.cos(rad) * (w / 2);
  const hy = Math.sin(rad) * (w / 2);
  const x1 = item.x - hx, y1 = item.y - hy;
  const x2 = item.x + hx, y2 = item.y + hy;
  // 기울기에 따른 문자
  const deg = Math.abs(((item.rotation || 0) % 180));
  const ch = (item.h && item.h > item.w) ? '|' : deg < 12 || deg > 168 ? '-' : (item.rotation || 0) > 0 ? '\\' : '/';
  const steps = Math.max(2, Math.round(w / 12));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    plot(grid, Math.round(y / PX_PER_ROW), colOf(x), ch);
  }
}

function render(key: string) {
  const m = MapPresets[key];
  if (!m) return;
  const rows = Math.ceil(m.worldHeight / PX_PER_ROW) + 1;
  const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: COLS }, () => ' '));

  // 벽 먼저(배경), 그 위에 기물
  for (const it of m.items as any[]) if (it.type === 'wall') rasterWall(grid, it);
  for (const it of m.items as any[]) {
    if (it.type === 'wall') continue;
    plot(grid, Math.round(it.y / PX_PER_ROW), colOf(it.x), glyph(it.type));
  }

  // 집계
  const counts: Record<string, number> = {};
  for (const it of m.items as any[]) counts[it.type] = (counts[it.type] || 0) + 1;
  const summary = Object.entries(counts).map(([t, n]) => `${t}:${n}`).join('  ');

  const border = '+' + '-'.repeat(COLS) + '+';
  console.log(`\n=== ${key}  「${m.name}」  H=${m.worldHeight} ===  기물: ${summary}`);
  console.log(border);
  // 연속 빈 행은 1개로 압축하여 형태만 간결히 보여줌
  let blanks = 0;
  for (const row of grid) {
    const s = row.join('');
    if (s.trim() === '') { blanks++; if (blanks > 1) continue; } else blanks = 0;
    console.log('|' + s + '|');
  }
  console.log(border);
}

const only = process.argv[2];
const keys = only ? [only] : Object.keys(MapPresets);
console.log('범례: .=핀 o=범퍼 ^=부스터 *=풍차 O=포탈 @=블랙홀 &=화이트홀 V=함정 H=피스톤 / \\ - |=벽');
for (const k of keys) render(k);
