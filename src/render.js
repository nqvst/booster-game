import { flagHome } from './sim/game.js'
import { COLOR, FONT, TEAM } from './art/theme.js'
import { createScenery, drawFlag, drawPad, drawRock } from './art/scenery.js'
import { drawCannon, drawLaser, drawRocket } from './art/sprites.js'
import { createEffects } from './art/effects.js'

const MUZZLE_FLASH = 0.08 // seconds after a shot

// Render-only state (camera, particles, banners) lives here, never in the sim.
// What things look like lives in src/art/; this file decides what goes where.
export function createRenderer(canvas, config) {
  const ctx = canvas.getContext('2d')
  const touch = matchMedia('(pointer: coarse)').matches
  const effects = createEffects()
  let scenery = null
  let sceneryFor = null // the game it was laid out for
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
      if (e.type === 'explode') effects.explode(e)
      if (e.type === 'capture') banner = { text: `${TEAM[e.team].label} CAPTURED THE FLAG`, until: clock + 2 }
    }

    const { map } = game
    if (sceneryFor !== game) {
      scenery = createScenery(map)
      sceneryFor = game
    }
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
    ctx.fillStyle = COLOR.void
    ctx.fillRect(0, 0, w, h)
    ctx.setTransform(scale, 0, 0, scale, w / 2 - cx * scale, h / 2 - cy * scale)

    scenery.backdrop(ctx, cx, cy, clock)
    for (const s of map.solids) if (!s.water) drawRock(ctx, s)
    for (const [team, base] of Object.entries(map.bases)) drawPad(ctx, base.pad, team, clock)

    for (const [team, t] of Object.entries(game.teams)) {
      const carrier = game.rockets.find((r) => r.id === t.flagCarrier)
      const at = carrier ? { x: carrier.x, y: carrier.y - 20 } : flagHome(map.bases[team])
      drawFlag(ctx, at.x, at.y, team, clock)
    }

    for (const c of game.cannons) drawCannon(ctx, c, c.cooldown > config.cannon.fireInterval - MUZZLE_FLASH)
    for (const b of game.bullets) drawLaser(ctx, b)
    for (const r of game.rockets) if (r.alive) drawRocket(ctx, r, config.rocket.engineOffset)
    effects.draw(ctx, dt)
    scenery.water(ctx, cx, clock) // last: reflects everything above it

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
      drawObjectiveArrow(ctx, (goal.x - cx) * (scale / dpr) + cw / 2, (goal.y - cy) * (scale / dpr) + ch / 2, cw, ch, TEAM[me.team].accent)
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.letterSpacing = '3px'
    ctx.font = `700 18px ${FONT}`
    const teams = Object.entries(game.teams)
    teams.forEach(([team, t], i) => {
      ctx.fillStyle = TEAM[team].accent
      ctx.shadowColor = TEAM[team].accent
      ctx.shadowBlur = 10
      ctx.fillText(`${TEAM[team].label} ${t.score}`, cw / 2 + (i - (teams.length - 1) / 2) * 140, 14)
    })
    ctx.shadowBlur = 0
    ctx.fillStyle = COLOR.textDim
    ctx.font = `600 11px ${FONT}`
    ctx.fillText(`FIRST TO ${config.rules.capturesToWin}`, cw / 2, 38)

    const message = game.winner
      ? `${TEAM[game.winner].label} WINS`
      : !me.alive
        ? `RESPAWNING IN ${Math.max(0, me.respawnAt - game.time).toFixed(1)}`
        : banner && clock < banner.until
          ? banner.text
          : null
    if (message) {
      ctx.font = `700 24px ${FONT}`
      ctx.fillStyle = COLOR.text
      ctx.shadowColor = TEAM[me.team].accent
      ctx.shadowBlur = 16
      ctx.fillText(message, cw / 2, ch * 0.3)
      ctx.shadowBlur = 0
    }
    ctx.letterSpacing = '0px'
  }
}

// Edge-of-screen pointer to the current objective when it's off screen.
function drawObjectiveArrow(ctx, sx, sy, cw, ch, accent) {
  const margin = 28
  if (sx > margin && sx < cw - margin && sy > margin && sy < ch - margin) return
  const angle = Math.atan2(sy - ch / 2, sx - cw / 2)
  const x = clamp(sx, margin, cw - margin)
  const y = clamp(sy, margin, ch - margin)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
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

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi)
}
