import { FLAG_HEIGHT } from '../sim/game.js'
import { COLOR, TEAM } from './theme.js'
import { TAU, additive, glowDot } from './brush.js'

// Things that stay put: dusk sky, distant mesas, rock, landing pads, flags.

// Far → near. k: 0 = pinned to the screen, 1 = moves with the world.
const MESA_LAYERS = [
  { k: 0.25, base: 0.8, rise: 260 },
  { k: 0.5, base: 0.87, rise: 170 },
]
const SUNS = [
  { x: 0.62, y: 0.7, r: 30 },
  { x: 0.665, y: 0.735, r: 18 },
]

// Random skyline is generated once per map; render-only, so Math.random is fine.
export function createBackdrop(map) {
  const { width, height } = map
  const stars = Array.from({ length: 180 }, () => ({
    x: rand(-500, width + 500),
    y: rand(0, height * 0.6),
    size: rand(0.6, 2),
    phase: rand(0, TAU),
  }))
  const mesas = MESA_LAYERS.map((l, i) => ({ k: l.k, color: COLOR.mesas[i], path: skyline(width, height * l.base, l.rise) }))

  // cx, cy: camera center in world units.
  return function draw(ctx, cx, cy, clock) {
    const sky = ctx.createLinearGradient(0, 0, 0, height)
    for (const [at, color] of COLOR.sky) sky.addColorStop(at, color)
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, width, height)

    parallax(ctx, 0.1, cx, cy, map, () => {
      ctx.fillStyle = COLOR.star
      for (const s of stars) {
        ctx.globalAlpha = (1 - s.y / (height * 0.6)) * (0.65 + 0.35 * Math.sin(clock * 2 + s.phase))
        ctx.fillRect(s.x, s.y, s.size, s.size)
      }
      ctx.globalAlpha = 1
      additive(ctx, () => {
        for (const s of SUNS) glowDot(ctx, s.x * width, s.y * height, s.r * 7, COLOR.sunGlow, 0.45)
      })
      ctx.fillStyle = COLOR.sun
      for (const s of SUNS) {
        ctx.beginPath()
        ctx.arc(s.x * width, s.y * height, s.r, 0, TAU)
        ctx.fill()
      }
    })

    for (const m of mesas) {
      parallax(ctx, m.k, cx, cy, map, () => {
        ctx.fillStyle = m.color
        ctx.fill(m.path)
      })
    }
  }
}

function parallax(ctx, k, cx, cy, map, draw) {
  ctx.save()
  ctx.translate((cx - map.width / 2) * (1 - k), (cy - map.height / 2) * (1 - k))
  draw()
  ctx.restore()
}

// Flat-topped buttes; filled far below the base so parallax never shows a gap.
function skyline(width, base, rise) {
  const path = new Path2D()
  let x = -1500
  path.moveTo(x, base + 2000)
  path.lineTo(x, base)
  while (x < width + 1500) {
    const top = base - rand(0.3, 1) * rise
    const w = rand(120, 420)
    path.lineTo(x + rand(15, 40), top)
    path.lineTo(x + w - rand(15, 40), top)
    path.lineTo(x + w, base)
    x += w + rand(0, 160)
    path.lineTo(x, base)
  }
  path.lineTo(x, base + 2000)
  path.closePath()
  return path
}

export function drawRock(ctx, s) {
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h)
  g.addColorStop(0, COLOR.rock[0])
  g.addColorStop(Math.min(1, 20 / s.h), COLOR.rock[1])
  g.addColorStop(1, COLOR.rock[2])
  ctx.fillStyle = g
  ctx.fillRect(s.x, s.y, s.w, s.h)
  ctx.fillStyle = COLOR.strata
  for (let y = s.y + 14; y < s.y + s.h; y += 17) ctx.fillRect(s.x, y, s.w, 1.5)
  ctx.fillRect(s.x + s.w - 4, s.y, 4, s.h)
  ctx.fillStyle = COLOR.rockLip
  ctx.fillRect(s.x, s.y, s.w, 3)
}

// Fills the whole pad rect (it's a solid too).
export function drawPad(ctx, { x, y, w, h }, team, clock) {
  const { accent } = TEAM[team]
  ctx.fillStyle = COLOR.metalDark
  ctx.fillRect(x + 8, y + 10, w - 16, h - 10)
  ctx.fillStyle = COLOR.creamShade
  for (let sx = x + 16; sx < x + w - 16; sx += 40) ctx.fillRect(sx, y + 10, 6, h - 10)

  const deck = ctx.createLinearGradient(0, y, 0, y + 10)
  deck.addColorStop(0, COLOR.cream)
  deck.addColorStop(1, COLOR.creamShade)
  ctx.fillStyle = deck
  ctx.fillRect(x, y, w, 10)
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, 10)

  // Hazard stripes
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y + 4, w, 5)
  ctx.clip()
  ctx.fillStyle = accent
  for (let i = -12; i < w; i += 12) {
    ctx.beginPath()
    ctx.moveTo(x + i, y + 9)
    ctx.lineTo(x + i + 6, y + 9)
    ctx.lineTo(x + i + 11, y + 4)
    ctx.lineTo(x + i + 5, y + 4)
    ctx.fill()
  }
  ctx.restore()

  const blink = Math.sin(clock * 4) > 0 ? 1 : 0.35
  additive(ctx, () => {
    for (const lx of [x + 5, x + w - 5]) glowDot(ctx, lx, y - 1, 9, accent, blink)
  })
}

// x, y: foot of the pole.
export function drawFlag(ctx, x, y, team, clock) {
  const { accent } = TEAM[team]
  const top = y - FLAG_HEIGHT
  const wave = (t) => Math.sin(clock * 6 - t * 5) * 2 * t

  ctx.fillStyle = COLOR.cream
  ctx.fillRect(x - 1, top, 2, FLAG_HEIGHT)
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.moveTo(x + 1, top)
  for (let i = 1; i <= 8; i++) ctx.lineTo(x + 1 + (i / 8) * 22, top + (i / 8) * 8 + wave(i / 8))
  for (let i = 7; i >= 0; i--) ctx.lineTo(x + 1 + (i / 8) * 22, top + 16 - (i / 8) * 8 + wave(i / 8))
  ctx.fill()
  additive(ctx, () => glowDot(ctx, x, top, 8, accent, 0.5 + 0.5 * Math.sin(clock * 5)))
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo)
}
