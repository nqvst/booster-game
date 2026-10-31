// Map format, checked wherever maps come in (game load, editor save on the dev server).
// Rects are { x, y, w, h } with y pointing down. Solids block rockets; `kind` picks the look:
// left out = rock, 'water' is sea (touching it crashes), the rest are building materials.
// Props are decoration standing on a surface, no collision; `flip: true` mirrors one to face the
// other way. Cannon x,y = the surface it stands on.
// biome picks how rock, the hills and the weather look (src/art/theme.ts BIOMES); left out = desert.
// mode: 'pve' = co-op vs CPU, blue (players) steal red's flag past red cannons; left out = pve.
// 'pvp' = team vs team: symmetric, both teams have a flag and cannons near their base.
// Returns a clean copy with only known fields; throws naming the bad field.

import { SLOT_SPACING } from '../sim/rocket.ts'

export const TEAMS = ['blue', 'red'] as const
const MODES = ['pve', 'pvp'] as const
export const BIOME_NAMES = ['desert', 'jungle', 'nautic'] as const
export const SOLID_KINDS = ['water', 'concrete', 'metal', 'hazard', 'panel', 'glass', 'planks', 'hull', 'stone'] as const // art in src/art/solids.ts
export const PROP_KINDS = ['lamp', 'starburst', 'beacon', 'tank', 'radar', 'saucer', 'palm', 'statue'] as const // art in src/art/props/
export const MIN_PAD_WIDTH = SLOT_SPACING // room for one spawn slot

export type Team = (typeof TEAMS)[number]
export type Mode = (typeof MODES)[number]
export type Biome = (typeof BIOME_NAMES)[number]
export type SolidKind = (typeof SOLID_KINDS)[number]
export type PropKind = (typeof PROP_KINDS)[number]

export type Rect = { x: number; y: number; w: number; h: number }
export type Solid = Rect & { kind?: SolidKind }
export type Prop = { kind: PropKind; x: number; y: number; flip?: boolean }
export type CannonSpot = { x: number; y: number; team: Team }
export type Base = { pad: Rect }
export type GameMap = {
  mode: Mode
  biome: Biome
  width: number
  height: number
  solids: Solid[]
  bases: Record<Team, Base>
  cannons: CannonSpot[]
  props: Prop[]
}

export function parseMap(raw: unknown, label: string): GameMap {
  const at = (path: string) => `Map "${label}": ${path}`
  if (!isObject(raw)) throw new Error(`${at('map')} must be an object`)
  return {
    mode: oneOf(raw.mode ?? 'pve', MODES, at('mode')),
    biome: oneOf(raw.biome ?? 'desert', BIOME_NAMES, at('biome')),
    width: positive(raw.width, at('width')),
    height: positive(raw.height, at('height')),
    solids: list(raw.solids, at('solids')).map((s, i) => solid(s, at(`solids[${i}]`))),
    bases: Object.fromEntries(TEAMS.map((team) => [team, { pad: pad(field(field(raw.bases, team), 'pad'), at(`bases.${team}.pad`)) }])) as Record<Team, Base>,
    cannons: list(raw.cannons, at('cannons')).map((c, i) => cannon(c, at(`cannons[${i}]`))),
    props: list(raw.props, at('props')).map((p, i) => prop(p, at(`props[${i}]`))),
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object'
}

// v.key, or undefined when v isn't an object at all.
function field(v: unknown, key: string): unknown {
  return isObject(v) ? v[key] : undefined
}

function solid(s: unknown, path: string): Solid {
  const r = rect(s, path)
  if (field(s, 'water') !== undefined) throw new Error(`${path}.water is no longer a field, use "kind": "water"`)
  const kind = field(s, 'kind')
  return kind === undefined ? r : { ...r, kind: oneOf(kind, SOLID_KINDS, `${path}.kind`) }
}

function pad(p: unknown, path: string): Rect {
  const r = rect(p, path)
  if (r.w < MIN_PAD_WIDTH) throw new Error(`${path}.w must be at least ${MIN_PAD_WIDTH}, got ${r.w}`)
  return r
}

function cannon(c: unknown, path: string): CannonSpot {
  return { x: finite(field(c, 'x'), `${path}.x`), y: finite(field(c, 'y'), `${path}.y`), team: oneOf(field(c, 'team'), TEAMS, `${path}.team`) }
}

function prop(p: unknown, path: string): Prop {
  const kind = oneOf(field(p, 'kind'), PROP_KINDS, `${path}.kind`)
  return { kind, x: finite(field(p, 'x'), `${path}.x`), y: finite(field(p, 'y'), `${path}.y`), ...(field(p, 'flip') === true && { flip: true }) }
}

function rect(r: unknown, path: string): Rect {
  if (!isObject(r)) throw new Error(`${path} must be an object`)
  return { x: finite(r.x, `${path}.x`), y: finite(r.y, `${path}.y`), w: positive(r.w, `${path}.w`), h: positive(r.h, `${path}.h`) }
}

function oneOf<T extends string>(v: unknown, options: readonly T[], path: string): T {
  if (!options.includes(v as T)) throw new Error(`${path} must be one of ${options}, got ${JSON.stringify(v)}`)
  return v as T
}

function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${path} must be an array`)
  return v
}

function finite(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${path} must be a number, got ${JSON.stringify(v)}`)
  return v
}

function positive(v: unknown, path: string): number {
  const n = finite(v, path)
  if (!(n > 0)) throw new Error(`${path} must be positive, got ${n}`)
  return n
}
