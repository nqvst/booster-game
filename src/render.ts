import type { Config } from './config.ts'
import type { GameEvent, GameView, ShownRocket } from './sim/game.ts'
import type { Scenery } from './art/scenery.ts'
import { context2d } from './dom.ts'
import { flagHome, otherTeam, teamEntries } from './sim/game.ts'
import { COLOR, FONT, TEAM } from './art/theme.ts'
import { fitCanvas } from './art/brush.ts'
import { createScenery, drawFlag, drawPad, randomWeather } from './art/scenery.ts'
import { drawSolid } from './art/solids.ts'
import { drawProp } from './art/props/index.ts'
import { drawCannon, drawLaser, drawRocket } from './art/sprites.ts'
import { createEffects } from './art/effects.ts'

const MUZZLE_FLASH = 0.08 // seconds after a shot

type Point = { x: number; y: number }

// Render-only state that lasts between frames.
type View = {
  touch: boolean
  effects: ReturnType<typeof createEffects>
  scenery: Scenery | null
  sceneryFor: GameView | null // the game it was laid out for
  banner: { text: string; until: number } | null
  clock: number
  cam: Point | null // eased camera position, before clamping to the map
}

// One frame's worth of everything the draw steps need. w, h: device pixels. cw, ch: CSS pixels.
type Frame = {
  ctx: CanvasRenderingContext2D
  game: GameView
  me: ShownRocket
  config: Config
  scenery: Scenery
  dt: number
  dpr: number
  w: number
  h: number
  cw: number
  ch: number
  scale: number
  cam: Point
}

// Render-only state (camera, particles, banners) lives here, never in the sim.
// What things look like lives in src/art/; this file decides what goes where.
export function createRenderer(canvas: HTMLCanvasElement, config: Config) {
  const ctx = context2d(canvas)
  const view: View = {
    touch: matchMedia('(pointer: coarse)').matches,
    effects: createEffects(),
    scenery: null,
    sceneryFor: null,
    banner: null,
    clock: 0,
    cam: null,
  }

  return function draw(game: GameView, localId: string, events: GameEvent[], dt: number): void {
    view.clock += dt
    const { dpr, w, h } = fitCanvas(canvas)
    applyEvents(view, events)
    const scenery = sceneryFor(view, game)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = COLOR.void
    ctx.fillRect(0, 0, w, h)
    const me = game.rockets.find((r) => r.id === localId)
    if (!me) return // Joining: no rocket until the host's first snapshot.

    const layout = { ctx, game, me, config, scenery, dt, dpr, w, h, cw: w / dpr, ch: h / dpr, scale: Math.max(w, h) / config.view.size }
    const frame = { ...layout, cam: followCamera(view, layout) }
    drawWorld(frame, view)
    drawHud(frame, view)
  }
}

// Random layout is made once per game.
function sceneryFor(view: View, game: GameView): Scenery {
  if (view.sceneryFor === game && view.scenery) return view.scenery
  const scenery = createScenery(game.map, randomWeather(game.map.biome))
  view.scenery = scenery
  view.sceneryFor = game
  return scenery
}

function applyEvents(view: View, events: GameEvent[]) {
  for (const e of events) {
    if (e.type === 'explode') view.effects.explode(e)
    if (e.type === 'capture') view.banner = { text: `${TEAM[e.team].label} CAPTURED THE FLAG`, until: view.clock + 2 }
  }
}

// Eases view.cam toward the local rocket; returns the center clamped to the map.
function followCamera(view: View, { me, game, w, h, scale, dt }: Omit<Frame, 'cam'>): Point {
  const cam = view.cam ?? { x: me.x, y: me.y }
  view.cam = cam
  const follow = Math.min(1, dt * 6)
  cam.x += (me.x - cam.x) * follow
  cam.y += (me.y - cam.y) * follow
  return {
    x: clamp(cam.x, w / scale / 2, game.map.width - w / scale / 2),
    y: clamp(cam.y, h / scale / 2, game.map.height - h / scale / 2),
  }
}

function drawWorld({ ctx, game, me, config, scenery, dt, w, h, scale, cam }: Frame, { effects, clock }: View) {
  const { map } = game
  ctx.setTransform(scale, 0, 0, scale, w / 2 - cam.x * scale, h / 2 - cam.y * scale)
  scenery.backdrop(ctx, cam.x, cam.y, clock)
  for (const s of map.solids) drawSolid(ctx, s, scenery.sky, map.biome)
  for (const [team, base] of teamEntries(map.bases)) drawPad(ctx, base.pad, team, clock)
  for (const p of map.props) drawProp(ctx, p, clock)
  drawFlags(ctx, game, clock)
  for (const c of game.cannons) drawCannon(ctx, c, c.cooldown > config.cannon.fireInterval - MUZZLE_FLASH, clock)
  for (const b of game.bullets) drawLaser(ctx, b)
  for (const r of game.rockets) if (r.alive) drawRocket(ctx, r, config.rocket.engineOffset, r === me)
  effects.draw(ctx, dt)
  scenery.water(ctx, cam.x, clock) // last: reflects everything above it
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  scenery.rain(ctx, cam.x * scale, cam.y * scale, clock)
}

function drawFlags(ctx: CanvasRenderingContext2D, game: GameView, clock: number) {
  for (const [team, t] of teamEntries(game.teams)) {
    if (!t.flag) continue
    const carrier = game.rockets.find((r) => r.id === t.flagCarrier)
    drawFlag(ctx, carrier ? { x: carrier.x, y: carrier.y - 20 } : flagHome(game.map.bases[team]), team, clock)
  }
}

function drawHud(frame: Frame, view: View) {
  const { ctx, dpr } = frame
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (view.touch) drawTouchZones(frame)
  if (frame.me.alive) drawObjective(frame)
  ctx.textAlign = 'center'
  drawNameBadges(frame)
  ctx.textBaseline = 'top'
  ctx.letterSpacing = '3px'
  drawScores(frame)
  const message = hudMessage(frame, view)
  if (message) drawMessage(frame, message)
  ctx.letterSpacing = '0px'
}

function drawTouchZones({ ctx, me, cw, ch }: Frame) {
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  if (me.input.left) ctx.fillRect(0, 0, cw / 2, ch)
  if (me.input.right) ctx.fillRect(cw / 2, 0, cw / 2, ch)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(cw / 2 - 0.5, 0, 1, ch)
}

// Enemy flag, or your own pad while carrying theirs.
function drawObjective(frame: Frame) {
  const { game, me, cam, scale, dpr, cw, ch } = frame
  const { bases } = game.map
  const carrying = Object.values(game.teams).some((t) => t.flagCarrier === me.id)
  const goal = flagHome(bases[carrying ? me.team : otherTeam(me.team)])
  const at = { x: (goal.x - cam.x) * (scale / dpr) + cw / 2, y: (goal.y - cam.y) * (scale / dpr) + ch / 2 }
  drawObjectiveArrow(frame, at, TEAM[me.team].accent)
}

// Edge-of-screen pointer to the objective when it's off screen. at: CSS pixels.
function drawObjectiveArrow({ ctx, cw, ch }: Frame, at: Point, accent: string) {
  const margin = 28
  if (at.x > margin && at.x < cw - margin && at.y > margin && at.y < ch - margin) return
  ctx.save()
  ctx.translate(clamp(at.x, margin, cw - margin), clamp(at.y, margin, ch - margin))
  ctx.rotate(Math.atan2(at.y - ch / 2, at.x - cw / 2))
  ctx.fillStyle = COLOR.text
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(12, 0)
  ctx.lineTo(-8, -8)
  ctx.lineTo(-4, 0)
  ctx.lineTo(-8, 8)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

// Other players' names above their rockets: blue = your team, red = the other team.
function drawNameBadges({ ctx, game, me, cam, scale, dpr, cw, ch }: Frame) {
  ctx.font = `600 11px ${FONT}`
  ctx.textBaseline = 'middle'
  for (const r of game.rockets) {
    if (!r.alive || r === me || !r.name) continue
    const x = (r.x - cam.x) * (scale / dpr) + cw / 2
    const y = (r.y - 40 - cam.y) * (scale / dpr) + ch / 2 // above the antenna
    const w = ctx.measureText(r.name).width + 10
    ctx.fillStyle = r.team === me.team ? COLOR.ally : COLOR.enemy
    ctx.beginPath()
    ctx.roundRect(x - w / 2, y - 8, w, 16, 8)
    ctx.fill()
    ctx.fillStyle = COLOR.text
    ctx.fillText(r.name, x, y + 0.5)
  }
}

function drawScores({ ctx, game, config, cw }: Frame) {
  ctx.font = `700 18px ${FONT}`
  const teams = teamEntries(game.teams)
  teams.forEach(([team, t], i) => {
    ctx.fillStyle = TEAM[team].accent
    ctx.shadowColor = TEAM[team].accent
    ctx.shadowBlur = 10
    ctx.fillText(`${TEAM[team].label} ${t.score}`, cw / 2 + (i - (teams.length - 1) / 2) * 140, 14)
  })
  ctx.shadowColor = COLOR.textShadow // readable on the bright day sky
  ctx.shadowBlur = 4
  ctx.fillStyle = COLOR.textDim
  ctx.font = `600 11px ${FONT}`
  ctx.fillText(goalText(game, config.rules), cw / 2, 38)
  ctx.shadowBlur = 0
}

function goalText(game: GameView, rules: Config['rules']) {
  if (game.mode === 'pvp') return `FIRST TO ${rules.capturesToWin}`
  return `${rules.capturesToWin} CAPTURES WIN · ${rules.cpuKillsToWin} SHOOT-DOWNS LOSE`
}

function hudMessage({ game, me }: Frame, { banner, clock }: View) {
  if (game.winner) return `${TEAM[game.winner].label} WINS`
  if (!me.alive) return `RESPAWNING IN ${Math.max(0, me.respawnAt - game.time).toFixed(1)}`
  if (banner && clock < banner.until) return banner.text
  return null
}

function drawMessage({ ctx, me, cw, ch }: Frame, message: string) {
  ctx.font = `700 24px ${FONT}`
  ctx.fillStyle = COLOR.text
  ctx.shadowColor = TEAM[me.team].accent
  ctx.shadowBlur = 16
  ctx.fillText(message, cw / 2, ch * 0.3)
  ctx.shadowBlur = 0
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi)
}
