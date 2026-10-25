import { FLAG_HEIGHT, flagHome } from './sim/game.js'
import { FEET } from './sim/rocket.js'
import { BARREL_LENGTH, PIVOT_HEIGHT } from './sim/cannon.js'

const TEAM_COLOR = { blue: '#4aa3ff', red: '#ff5a4f' }
const ROCK = '#2b3048'

// Render-only state (camera, particles, banners) lives here, never in the sim.
export function createRenderer(canvas, config) {
  const ctx = canvas.getContext('2d')
  const touch = matchMedia('(pointer: coarse)').matches
  let particles = []
  let banner = null
  let clock = 0
  let cam = null

  return function draw(game, localId, events, dt) {
    clock += dt
    const dpr = devicePixelRatio || 1
    const w = Math.round(canvas.clientWidth * dpr)
    const h = Math.round(canvas.clientHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    for (const e of events) {
      if (e.type === 'explode') particles.push(...burst(e))
      if (e.type === 'capture') banner = { text: `${e.team.toUpperCase()} CAPTURED THE FLAG`, until: clock + 2 }
    }

    const { map } = game
    const me = game.rockets.find((r) => r.id === localId)
    const scale = Math.max(w, h) / config.view.size
    cam ??= { x: me.x, y: me.y }
    const follow = Math.min(1, dt * 6)
    cam.x += (me.x - cam.x) * follow
    cam.y += (me.y - cam.y) * follow
    const cx = clamp(cam.x, w / scale / 2, map.width - w / scale / 2)
    const cy = clamp(cam.y, h / scale / 2, map.height - h / scale / 2)

    // World
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = ROCK
    ctx.fillRect(0, 0, w, h)
    ctx.setTransform(scale, 0, 0, scale, w / 2 - cx * scale, h / 2 - cy * scale)

    const sky = ctx.createLinearGradient(0, 0, 0, map.height)
    sky.addColorStop(0, '#0c1230')
    sky.addColorStop(1, '#2c3a5c')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, map.width, map.height)

    ctx.fillStyle = ROCK
    for (const s of map.solids) ctx.fillRect(s.x, s.y, s.w, s.h)
    for (const [team, base] of Object.entries(map.bases)) {
      ctx.fillStyle = TEAM_COLOR[team]
      ctx.fillRect(base.pad.x, base.pad.y, base.pad.w, 5)
    }

    for (const [team, t] of Object.entries(game.teams)) {
      const carrier = game.rockets.find((r) => r.id === t.flagCarrier)
      const at = carrier ? { x: carrier.x, y: carrier.y - 20 } : flagHome(map.bases[team])
      drawFlag(ctx, at.x, at.y, TEAM_COLOR[team])
    }

    for (const c of game.cannons) {
      ctx.strokeStyle = '#8a91a8'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(c.x, c.y - PIVOT_HEIGHT)
      ctx.lineTo(c.x + Math.cos(c.aim) * BARREL_LENGTH, c.y - PIVOT_HEIGHT + Math.sin(c.aim) * BARREL_LENGTH)
      ctx.stroke()
      ctx.fillStyle = TEAM_COLOR[c.team]
      ctx.beginPath()
      ctx.arc(c.x, c.y - PIVOT_HEIGHT, 7, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = '#ffd27a'
    for (const b of game.bullets) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const r of game.rockets) if (r.alive) drawRocket(ctx, r, config.rocket.engineOffset)

    particles = particles.filter((p) => (p.life -= dt) > 0)
    for (const p of particles) {
      p.vy += 200 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      ctx.globalAlpha = p.life / p.max
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
    }
    ctx.globalAlpha = 1

    // HUD (CSS pixels)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cw = w / dpr
    const ch = h / dpr

    if (touch) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      if (me.input.left) ctx.fillRect(0, 0, cw / 2, ch)
      if (me.input.right) ctx.fillRect(cw / 2, 0, cw / 2, ch)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(cw / 2 - 0.5, 0, 1, ch)
    }

    if (me.alive) {
      const carrying = Object.values(game.teams).some((t) => t.flagCarrier === me.id)
      const enemy = Object.keys(map.bases).find((t) => t !== me.team)
      const goal = carrying ? flagHome(map.bases[me.team]) : flagHome(map.bases[enemy])
      drawObjectiveArrow(ctx, (goal.x - cx) * (scale / dpr) + cw / 2, (goal.y - cy) * (scale / dpr) + ch / 2, cw, ch)
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = '600 18px system-ui, sans-serif'
    const teams = Object.entries(game.teams)
    teams.forEach(([team, t], i) => {
      ctx.fillStyle = TEAM_COLOR[team]
      ctx.fillText(`${team.toUpperCase()} ${t.score}`, cw / 2 + (i - (teams.length - 1) / 2) * 110, 14)
    })
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(`first to ${config.rules.capturesToWin}`, cw / 2, 38)

    ctx.font = '600 24px system-ui, sans-serif'
    ctx.fillStyle = '#fff'
    const message = game.winner
      ? `${game.winner.toUpperCase()} WINS`
      : !me.alive
        ? `Respawning in ${Math.max(0, me.respawnAt - game.time).toFixed(1)}`
        : banner && clock < banner.until
          ? banner.text
          : null
    if (message) ctx.fillText(message, cw / 2, ch * 0.3)
  }
}

function drawRocket(ctx, r, offset) {
  ctx.save()
  ctx.translate(r.x, r.y)
  ctx.rotate(r.angle)

  ctx.fillStyle = '#ffb347'
  for (const [on, side] of [[r.input.left, -1], [r.input.right, 1]]) {
    if (!on) continue
    const x = side * offset
    ctx.beginPath()
    ctx.moveTo(x - 4, 12)
    ctx.lineTo(x + 4, 12)
    ctx.lineTo(x, 26 + Math.random() * 10)
    ctx.fill()
  }

  ctx.strokeStyle = '#9aa4c0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-offset, 9) // engine strut: shows the balance setting
  ctx.lineTo(offset, 9)
  for (const [fx, fy] of FEET) {
    ctx.moveTo(Math.sign(fx) * 6, 4)
    ctx.lineTo(fx, fy)
  }
  ctx.stroke()

  ctx.fillStyle = '#cfd6e6'
  ctx.fillRect(-offset - 3, 7, 6, 6)
  ctx.fillRect(offset - 3, 7, 6, 6)

  ctx.fillStyle = TEAM_COLOR[r.team]
  ctx.beginPath()
  ctx.moveTo(0, -24)
  ctx.lineTo(8, -10)
  ctx.lineTo(8, 8)
  ctx.lineTo(-8, 8)
  ctx.lineTo(-8, -10)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#e8f1ff'
  ctx.beginPath()
  ctx.arc(0, -6, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawFlag(ctx, x, y, color) {
  ctx.strokeStyle = '#d8dce8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y - FLAG_HEIGHT)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y - FLAG_HEIGHT)
  ctx.lineTo(x + 22, y - FLAG_HEIGHT + 8)
  ctx.lineTo(x, y - FLAG_HEIGHT + 16)
  ctx.fill()
}

// Edge-of-screen pointer to the current objective when it's off screen.
function drawObjectiveArrow(ctx, sx, sy, cw, ch) {
  const margin = 28
  if (sx > margin && sx < cw - margin && sy > margin && sy < ch - margin) return
  const angle = Math.atan2(sy - ch / 2, sx - cw / 2)
  const x = clamp(sx, margin, cw - margin)
  const y = clamp(sy, margin, ch - margin)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.beginPath()
  ctx.moveTo(12, 0)
  ctx.lineTo(-8, -8)
  ctx.lineTo(-8, 8)
  ctx.fill()
  ctx.restore()
}

function burst({ x, y, team }) {
  return Array.from({ length: 40 }, (_, i) => {
    const a = Math.random() * Math.PI * 2
    const speed = 60 + Math.random() * 260
    const max = 0.5 + Math.random() * 0.7
    return { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: max, max, color: i % 3 ? '#ffb347' : TEAM_COLOR[team] }
  })
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi)
}
