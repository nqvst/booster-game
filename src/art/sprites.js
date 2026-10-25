import { FEET } from '../sim/rocket.js'
import { BARREL_LENGTH, PIVOT_HEIGHT, cannonPedestal } from '../sim/cannon.js'
import { COLOR, TEAM } from './theme.js'
import { TAU, additive, glowDot, shaded } from './brush.js'

// Things that move. Each draws a sim object at its own world position,
// so /art.html can show them with fake objects.

// Same outline as the hull collision points in sim/rocket.js.
const BODY = new Path2D('M0 -24 Q8 -18 8 -10 L8 8 L-8 8 L-8 -10 Q-8 -18 0 -24 Z')
const LASER_LENGTH = 24

export function drawRocket(ctx, r, engineOffset) {
  const { accent, hull } = TEAM[r.team]
  ctx.save()
  ctx.translate(r.x, r.y)
  ctx.rotate(r.angle)

  additive(ctx, () => {
    if (r.input.left) drawPlume(ctx, -engineOffset, 15)
    if (r.input.right) drawPlume(ctx, engineOffset, 15)
  })

  // Landing legs
  ctx.strokeStyle = COLOR.legs
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const [fx, fy] of FEET) {
    ctx.moveTo(Math.sign(fx) * 6, 4)
    ctx.lineTo(fx, fy)
  }
  ctx.stroke()
  ctx.fillStyle = COLOR.outline
  for (const [fx, fy] of FEET) ctx.fillRect(fx - 3, fy - 2, 6, 2)

  // Engine strut + pods: the width shows the balance setting
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 0.8
  ctx.fillStyle = hull[1]
  ctx.fillRect(-engineOffset, 7.5, engineOffset * 2, 3)
  ctx.strokeRect(-engineOffset, 7.5, engineOffset * 2, 3)
  for (const x of [-engineOffset, engineOffset]) {
    ctx.fillStyle = COLOR.metalDark
    ctx.beginPath()
    ctx.moveTo(x - 3, 12)
    ctx.lineTo(x + 3, 12)
    ctx.lineTo(x + 4.5, 16)
    ctx.lineTo(x - 4.5, 16)
    ctx.fill()
    ctx.fillStyle = shaded(ctx, x - 4, x + 4, hull)
    ctx.beginPath()
    ctx.roundRect(x - 4, 1, 8, 12, 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = accent
    ctx.fillRect(x - 4, 3.5, 8, 2)
  }

  // Hull
  ctx.fillStyle = shaded(ctx, -8, 8, hull)
  ctx.fill(BODY)
  ctx.save()
  ctx.clip(BODY)
  ctx.fillStyle = accent
  ctx.fillRect(-8, -3, 16, 4)
  ctx.fillRect(-8, 3, 16, 1.5)
  ctx.strokeStyle = COLOR.panelLine
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(-8, -9)
  ctx.lineTo(8, -9)
  ctx.moveTo(0, 4.5)
  ctx.lineTo(0, 8)
  ctx.stroke()
  ctx.fillStyle = COLOR.gloss
  ctx.fillRect(-5.5, -17, 1.5, 24)
  ctx.restore()
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 1
  ctx.stroke(BODY)

  // Canopy
  ctx.fillStyle = COLOR.canopy
  ctx.beginPath()
  ctx.ellipse(0, -13, 3.5, 4.5, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = COLOR.canopyGlint
  ctx.beginPath()
  ctx.ellipse(-1.3, -14.5, 0.9, 1.6, 0, 0, TAU)
  ctx.fill()

  ctx.restore()
}

function drawPlume(ctx, x, y) {
  const len = 22 + Math.random() * 12
  const g = ctx.createLinearGradient(0, y, 0, y + len)
  g.addColorStop(0, COLOR.flame[0])
  g.addColorStop(0.3, COLOR.flame[1])
  g.addColorStop(1, COLOR.flame[2])
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(x - 4.5, y)
  ctx.quadraticCurveTo(x, y + len * 2, x + 4.5, y)
  ctx.fill()
  glowDot(ctx, x, y + 2, 10, COLOR.flame[1], 0.4)
}

// firing: show a muzzle flash this frame.
export function drawCannon(ctx, c, firing) {
  const { accent, laser } = TEAM[c.team]
  const p = cannonPedestal(c)
  const px = c.x
  const py = c.y - PIVOT_HEIGHT

  ctx.fillStyle = shaded(ctx, p.x, p.x + p.w, COLOR.gunmetal)
  ctx.fillRect(p.x, p.y, p.w, p.h)
  ctx.fillStyle = accent
  ctx.fillRect(p.x, p.y + 3, p.w, 2)

  // Twin barrels
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(c.aim)
  ctx.fillStyle = COLOR.gunmetal[2]
  ctx.fillRect(0, -4, BARREL_LENGTH, 3)
  ctx.fillRect(0, 1, BARREL_LENGTH, 3)
  ctx.fillStyle = COLOR.metalDark
  ctx.fillRect(BARREL_LENGTH - 4, -4.5, 4, 4)
  ctx.fillRect(BARREL_LENGTH - 4, 0.5, 4, 4)
  if (firing) additive(ctx, () => glowDot(ctx, BARREL_LENGTH + 2, 0, 14, laser))
  ctx.restore()

  // Dome with glowing sensor eye
  ctx.fillStyle = shaded(ctx, px - 11, px + 11, COLOR.gunmetal)
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(px, p.y, 11, Math.PI, 0)
  ctx.fill()
  ctx.stroke()
  additive(ctx, () => glowDot(ctx, px, py + 1, 6, accent, 0.9))
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(px, py + 1, 1.8, 0, TAU)
  ctx.fill()
}

export function drawLaser(ctx, b) {
  const { laser } = TEAM[b.team]
  const k = LASER_LENGTH / Math.hypot(b.vx, b.vy)
  additive(ctx, () => {
    ctx.lineCap = 'round'
    for (const [width, color, alpha] of [[9, laser, 0.2], [4, laser, 0.7], [1.5, '#fff', 1]]) {
      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(b.x - b.vx * k, b.y - b.vy * k)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  })
}
