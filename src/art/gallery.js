import { config } from '../config.js'
import { canyon } from '../maps/canyon.js'
import { COLOR, FONT } from './theme.js'
import { createScenery, drawFlag, drawPad, drawRock } from './scenery.js'
import { drawCannon, drawLaser, drawRocket } from './sprites.js'
import { createEffects } from './effects.js'

// Art preview: every sprite on one screen, animated, over the real scenery.
// `npm run dev`, open /art.html; edits in src/art/ reload instantly.
// New sprite → add a cell here.

const CELL = 100 // world units
const ZOOM = 3

const rocket = (x, y, team, left, right, angle = 0) => ({ x, y, team, angle, input: { left, right } })

const cells = [
  ['rocket idle', (ctx, x, y) => drawRocket(ctx, rocket(x, y, 'blue', false, false), config.rocket.engineOffset)],
  ['both engines', (ctx, x, y) => drawRocket(ctx, rocket(x, y - 10, 'blue', true, true), config.rocket.engineOffset)],
  ['turning', (ctx, x, y, t) => drawRocket(ctx, rocket(x, y - 10, 'blue', true, false, Math.sin(t) * 0.5), config.rocket.engineOffset)],
  ['red team', (ctx, x, y) => drawRocket(ctx, rocket(x, y - 10, 'red', true, true), config.rocket.engineOffset)],
  ['cannon', (ctx, x, y, t) => drawCannon(ctx, { x, y: y + 25, team: 'red', aim: -1.2 + Math.sin(t) * 0.6 }, t % 1.2 < 0.08)],
  ['lasers', (ctx, x, y, t) => {
    const dx = ((t * 120) % 80) - 40
    drawLaser(ctx, { x: x + dx, y: y - 15, vx: 350, vy: 0, team: 'red' })
    drawLaser(ctx, { x: x + dx, y: y + 15, vx: 350, vy: 0, team: 'blue' })
  }],
  ['flags', (ctx, x, y, t) => {
    drawFlag(ctx, x - 20, y + 25, 'blue', t)
    drawFlag(ctx, x + 10, y + 25, 'red', t)
  }],
  ['pad + rock', (ctx, x, y, t) => {
    drawRock(ctx, { x: x - 45, y: y + 20, w: 90, h: 25 })
    drawPad(ctx, { x: x - 35, y: y, w: 70, h: 20 }, 'blue', t)
  }],
  ['explosion', (ctx, x, y, t, boom) => boom({ x, y, team: 'blue' })],
]

const canvas = document.querySelector('canvas')
const ctx = canvas.getContext('2d')
const scenery = createScenery(canyon)
const effects = createEffects()
let clock = 0
let nextBoom = 0
let last = performance.now()

requestAnimationFrame(function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1)
  last = now
  clock += dt
  const dpr = devicePixelRatio || 1
  const w = Math.round(canvas.clientWidth * dpr)
  const h = Math.round(canvas.clientHeight * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }

  // Whole map scaled to fill the screen
  const fit = Math.max(w / canyon.width, h / canyon.height)
  ctx.setTransform(fit, 0, 0, fit, 0, 0)
  scenery.backdrop(ctx, canyon.width / 2, canyon.height / 2, clock)
  for (const s of canyon.solids) if (!s.water) drawRock(ctx, s)
  for (const [team, base] of Object.entries(canyon.bases)) drawPad(ctx, base.pad, team, clock)
  scenery.water(ctx, canyon.width / 2, clock)

  const zoom = ZOOM * dpr
  const cols = Math.max(1, Math.floor(w / (CELL * zoom)))
  const boom = (e) => {
    if (clock < nextBoom) return
    effects.explode(e)
    nextBoom = clock + 1.5
  }
  ctx.setTransform(zoom, 0, 0, zoom, 0, 0)
  cells.forEach(([label, draw], i) => {
    const x = (i % cols) * CELL + CELL / 2
    const y = Math.floor(i / cols) * CELL + CELL / 2
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4)
    draw(ctx, x, y, clock, boom)
    ctx.fillStyle = COLOR.textDim
    ctx.font = `600 5px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(label.toUpperCase(), x, y + CELL / 2 - 6)
  })
  effects.draw(ctx, dt)

  requestAnimationFrame(frame)
})
