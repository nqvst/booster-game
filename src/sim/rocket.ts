import type { Config } from '../config.ts'
import type { GameMap, Rect, Team } from '../maps/parse.ts'
import { solidAt, wrapAngle } from './geometry.ts'

export type Input = { left: boolean; right: boolean }

export type Rocket = {
  id: string
  team: Team
  name: string
  slot: number // place along the team's pad
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  alive: boolean
  landed: boolean
  input: Input
  respawnAt: number // game.time of the next respawn; only means something while dead
}

type Point = readonly [x: number, y: number]

// Local shape: origin = center of mass, -y = nose. Angle 0 = upright, positive = clockwise.
// Hull points crash on any contact; only the feet may touch ground.
const HULL: readonly Point[] = [[0, -24], [-8, -10], [8, -10], [-8, 0], [8, 0], [-8, 8], [8, 8]]
export const FEET: readonly Point[] = [[-13, 18], [13, 18]]
export const FOOT_Y = 18
const MAX_FOOT_SINK = 8 // a foot deeper than this (beyond this tick's fall) hit a wall side, not a top surface

export const NO_INPUT: Readonly<Input> = Object.freeze({ left: false, right: false })
export const SLOT_SPACING = 40 // spawn slots sit this far apart along a pad, the first one this far in

// Everything a respawn resets.
export function spawnState(slot: number, pad: Rect) {
  return {
    x: pad.x + (slot + 1) * SLOT_SPACING,
    y: pad.y - FOOT_Y,
    vx: 0,
    vy: 0,
    angle: 0,
    spin: 0,
    alive: true,
    landed: true,
    input: NO_INPUT,
  }
}

// Returns true if the rocket crashed this tick.
export function stepRocket(r: Rocket, map: GameMap, config: Config, dt: number): boolean {
  const { thrust, engineOffset, inertia, spinDamping, drag } = config.rocket
  const left = r.input.left ? thrust : 0
  const right = r.input.right ? thrust : 0

  // Left engine pushes the left side up → clockwise torque → nose tilts right.
  r.spin += (((left - right) * engineOffset) / inertia) * dt
  r.spin *= Math.max(0, 1 - spinDamping * dt)
  r.angle = wrapAngle(r.angle + r.spin * dt)

  const push = left + right
  r.vx += push * Math.sin(r.angle) * dt
  r.vy += (config.world.gravity - push * Math.cos(r.angle)) * dt
  const keep = Math.max(0, 1 - drag * dt)
  r.vx *= keep
  r.vy *= keep
  r.x += r.vx * dt
  r.y += r.vy * dt

  return resolveContact(r, map, config.rocket.safeLandingAngle, dt)
}

function toWorld(r: Rocket, [lx, ly]: Point): Point {
  const c = Math.cos(r.angle)
  const s = Math.sin(r.angle)
  return [r.x + lx * c - ly * s, r.y + lx * s + ly * c]
}

function resolveContact(r: Rocket, map: GameMap, safeLandingAngle: number, dt: number): boolean {
  r.landed = false
  if (HULL.some((p) => solidAt(map, ...toWorld(r, p)))) return true

  const maxSink = MAX_FOOT_SINK + Math.max(0, r.vy) * dt
  let surface = Infinity
  for (const p of FEET) {
    const [x, y] = toWorld(r, p)
    const rect = solidAt(map, x, y)
    if (!rect) continue
    if (rect.kind === 'water' || y - rect.y > maxSink) return true // sea is never a landing spot
    surface = Math.min(surface, rect.y)
  }
  if (surface === Infinity) return false

  if (Math.abs(r.angle) > safeLandingAngle) return true
  Object.assign(r, { y: surface - FOOT_Y, angle: 0, spin: 0, vx: 0, vy: 0, landed: true })
  return false
}
