import type { GameMap, Solid } from '../maps/parse.ts'

// Outside the map counts as solid. y = -Infinity makes a foot "sink" infinitely
// deep, so touching the map edge is always a crash.
const OUT_OF_BOUNDS: Solid = { x: -Infinity, y: -Infinity, w: Infinity, h: Infinity }

export function solidAt(map: GameMap, x: number, y: number): Solid | null {
  if (x < 0 || y < 0 || x > map.width || y > map.height) return OUT_OF_BOUNDS
  return map.solids.find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) ?? null
}

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}
