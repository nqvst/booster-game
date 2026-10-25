import { FLAG_HEIGHT } from '../sim/game.js'
import { COLOR, TEAM } from './theme.js'
import { TAU, additive, glowDot } from './brush.js'

// Things that stay put: dusk sky, distant mesas, sea, rock, landing pads, flags.

// Parallax k: 0 = pinned to the screen, 1 = moves with the world.
const SKY_LAYER = 0.1 // stars, suns
const CLOUD_LAYER = 0.15 // clouds, passing ships
// Far → near. size scales butte width and lights; lit = share of buttes with windows.
const MESA_LAYERS = [
  { k: 0.2, base: 0.8, rise: 320, size: 0.6, lit: 0 },
  { k: 0.32, base: 0.84, rise: 260, size: 0.8, lit: 0.2 },
  { k: 0.46, base: 0.88, rise: 200, size: 1, lit: 0.4 },
  { k: 0.62, base: 0.92, rise: 150, size: 1.2, lit: 0.6 },
]
const SUNS = [
  { x: 0.62, y: 0.7, r: 30 },
  { x: 0.665, y: 0.735, r: 18 },
]

// Random layout is generated once per map; render-only, so Math.random is fine.
// Solids tagged `water` are drawn as sea; draw everything else first, then water().
export function createScenery(map) {
  const { width, height } = map
  const stars = Array.from({ length: 180 }, () => ({
    x: rand(-500, width + 500),
    y: rand(0, height * 0.6),
    size: rand(0.6, 2),
    phase: rand(0, TAU),
  }))
  const clouds = Array.from({ length: 7 }, () => ({
    x: rand(-300, width + 300),
    y: rand(0.3, 0.62) * height,
    rx: rand(250, 600),
    ry: rand(6, 16),
  }))
  const ships = Array.from({ length: 3 }, (_, i) => ({
    y: rand(0.15, 0.5) * height,
    speed: rand(15, 40) * (i % 2 ? -1 : 1),
    offset: rand(0, width),
    phase: rand(0, TAU),
  }))
  const mesas = MESA_LAYERS.map((l, i) => {
    const base = height * l.base
    return { ...l, base, color: COLOR.mesas[i], ...skyline(width, base, l) }
  })
  const seas = map.solids
    .filter((s) => s.water)
    .map((rect) => ({
      rect,
      ripples: Array.from({ length: Math.round(rect.w / 10) }, () => ({
        x: rand(rect.x, rect.x + rect.w),
        depth: rand(2, rect.h),
        len: rand(6, 30),
        phase: rand(0, TAU),
      })),
      glints: Array.from({ length: 60 }, () => ({
        dx: (rand(0, 1) + rand(0, 1) + rand(0, 1) - 1.5) * 120,
        depth: rand(1, rect.h * 0.7),
        len: rand(4, 16),
        phase: rand(0, TAU),
      })),
      shores: map.solids.filter((s) => !s.water && s.y + s.h === rect.y && s.x < rect.x + rect.w && s.x + s.w > rect.x),
    }))
  const mirror = document.createElement('canvas')

  return {
    // cx, cy: camera center in world units.
    backdrop(ctx, cx, cy, clock) {
      const sky = ctx.createLinearGradient(0, 0, 0, height)
      for (const [at, color] of COLOR.sky) sky.addColorStop(at, color)
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, height)

      parallax(ctx, SKY_LAYER, cx, cy, map, () => {
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

      parallax(ctx, CLOUD_LAYER, cx, cy, map, () => {
        for (const c of clouds) {
          const g = ctx.createLinearGradient(0, c.y - c.ry, 0, c.y + c.ry)
          g.addColorStop(0, COLOR.cloud[0])
          g.addColorStop(1, COLOR.cloud[1])
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, TAU)
          ctx.fill()
        }
        const span = width + 1000
        additive(ctx, () => {
          for (const s of ships) {
            const x = ((((s.offset + clock * s.speed) % span) + span) % span) - 500
            glowDot(ctx, x, s.y, 4, COLOR.shipLight, 0.8)
            if (Math.sin(clock * 3 + s.phase) > 0.9) glowDot(ctx, x + 3, s.y, 10, COLOR.shipLight)
          }
        })
      })

      for (const m of mesas) {
        parallax(ctx, m.k, cx, cy, map, () => {
          ctx.fillStyle = m.color
          ctx.fill(m.path)
          const fog = m.rise * 0.5
          const haze = ctx.createLinearGradient(0, m.base - fog, 0, m.base)
          haze.addColorStop(0, COLOR.haze[0])
          haze.addColorStop(1, COLOR.haze[1])
          ctx.fillStyle = haze
          ctx.fillRect(-1500, m.base - fog, width + 3000, fog)
          ctx.fillStyle = COLOR.haze[1]
          ctx.fillRect(-1500, m.base, width + 3000, 2000)

          additive(ctx, () => {
            for (const w of m.windows) {
              glowDot(ctx, w.x, w.y, 9 * m.size, COLOR.windowLight, 0.35)
              ctx.fillStyle = COLOR.windowLight
              ctx.fillRect(w.x - 1.5 * m.size, w.y - 1.5 * m.size, 3 * m.size, 3 * m.size)
            }
            for (const b of m.beacons) {
              glowDot(ctx, b.x, b.y, 16 * m.size, COLOR.beacon, Math.sin(clock * 2.5 + b.phase) > 0.6 ? 1 : 0.15)
            }
          })
        })
      }
    },

    water(ctx, cx, clock) {
      const sunX = SUNS[0].x * width + (cx - width / 2) * (1 - SKY_LAYER)
      for (const sea of seas) drawSea(ctx, sea, sunX, clock, mirror)
    },
  }
}

function parallax(ctx, k, cx, cy, map, draw) {
  ctx.save()
  ctx.translate((cx - map.width / 2) * (1 - k), (cy - map.height / 2) * (1 - k))
  draw()
  ctx.restore()
}

// Flat-topped buttes; filled far below the base so parallax never shows a gap.
function skyline(width, base, { rise, size, lit }) {
  const path = new Path2D()
  const windows = []
  const beacons = []
  let x = -1500
  path.moveTo(x, base + 2000)
  path.lineTo(x, base)
  while (x < width + 1500) {
    const top = base - rand(0.45, 1) * rise
    const w = rand(120, 420) * size
    const slope = rand(15, 40) * size
    path.lineTo(x + slope, top)
    path.lineTo(x + w - slope, top)
    path.lineTo(x + w, base)
    if (Math.random() < lit) {
      const at = rand(x + w * 0.3, x + w * 0.7)
      for (let n = rand(3, 9); n > 0; n--) {
        windows.push({ x: at + rand(-0.2, 0.2) * w, y: rand(top + 12 * size, base - 8) })
      }
    }
    if (lit && base - top > rise * 0.75) beacons.push({ x: x + w / 2, y: top - 2, phase: rand(0, TAU) })
    x += w + rand(0, 160) * size
    path.lineTo(x, base)
  }
  path.lineTo(x, base + 2000)
  path.closePath()
  return { path, windows, beacons }
}

// Mirrors what's already drawn above the surface, in wavy pixel rows, then tints it.
function drawSea(ctx, { rect, ripples, glints, shores }, sunX, clock, mirror) {
  const m = ctx.getTransform()
  const top = Math.round(rect.y * m.d + m.f)
  const bottom = Math.min(ctx.canvas.height, Math.round((rect.y + rect.h) * m.d + m.f))
  const h = Math.min(bottom - top, top)
  if (h <= 0) return

  const w = ctx.canvas.width
  if (mirror.width !== w || mirror.height !== h) {
    mirror.width = w
    mirror.height = h
  }
  mirror.getContext('2d').drawImage(ctx.canvas, 0, top - h, w, h, 0, 0, w, h)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const band = 2
  for (let y = 0; y < h; y += band) {
    const depth = y / m.d // world units below the surface
    const dx = Math.sin(clock * 2 + depth * 0.25) * (0.5 + depth * 0.06) * m.a
    ctx.drawImage(mirror, 0, Math.max(0, h - y - band), w, band, dx - 8, top + y, w + 16, band)
  }
  ctx.restore()

  const tint = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h)
  tint.addColorStop(0, COLOR.water[0])
  tint.addColorStop(1, COLOR.water[1])
  ctx.fillStyle = tint
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)

  ctx.fillStyle = COLOR.ripple
  for (const r of ripples) ctx.fillRect(r.x + Math.sin(clock * 1.5 + r.phase) * 6, rect.y + r.depth, r.len, 1)

  additive(ctx, () => {
    ctx.fillStyle = COLOR.glint
    for (const g of glints) {
      ctx.globalAlpha = Math.max(0, Math.sin(clock * 5 + g.phase))
      ctx.fillRect(sunX + g.dx * (0.4 + g.depth / rect.h), rect.y + g.depth, g.len, 1.2)
    }
    ctx.globalAlpha = 1
  })

  ctx.fillStyle = COLOR.waterLine
  ctx.fillRect(rect.x, rect.y, rect.w, 1)
  ctx.fillStyle = COLOR.foam
  for (const s of shores) {
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(clock * 2 + s.x)
    ctx.fillRect(s.x - 4, rect.y - 0.5, s.w + 8, 2)
  }
  ctx.globalAlpha = 1
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
