import { COLOR, TEAM } from './theme.js'
import { TAU, additive, glowDot } from './brush.js'

// Explosions: smoke under, flash + sparks on top. Render-only, so Math.random is fine.
export function createEffects() {
  let particles = []

  return {
    explode({ x, y, team }) {
      const smoke = Array.from({ length: 12 }, () => particle(x, y, 20, 80, 1.2, 2, { kind: 'smoke', gravity: -30, size: 6 + Math.random() * 6 }))
      const flash = { x, y, vx: 0, vy: 0, life: 0.25, max: 0.25, kind: 'flash', gravity: 0, size: 60 }
      const sparks = Array.from({ length: 40 }, (_, i) =>
        particle(x, y, 80, 380, 0.4, 1, {
          kind: 'spark',
          gravity: 200,
          size: 1.5 + Math.random() * 1.5,
          color: i % 4 ? COLOR.spark[i % 3] : TEAM[team].accent,
        }),
      )
      particles.push(...smoke, flash, ...sparks)
    },

    draw(ctx, dt) {
      particles = particles.filter((p) => (p.life -= dt) > 0)
      for (const p of particles) {
        p.vy += p.gravity * dt
        if (p.kind === 'smoke') p.vx *= 1 - 1.5 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        const t = p.life / p.max // 1 → 0

        if (p.kind === 'smoke') {
          ctx.globalAlpha = t * 0.45
          ctx.fillStyle = COLOR.smoke
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (2 - t), 0, TAU)
          ctx.fill()
          ctx.globalAlpha = 1
        } else if (p.kind === 'flash') {
          additive(ctx, () => glowDot(ctx, p.x, p.y, p.size * (1.6 - t), COLOR.spark[0], t))
        } else {
          additive(ctx, () => {
            ctx.globalAlpha = t
            ctx.strokeStyle = p.color
            ctx.lineWidth = p.size
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03)
            ctx.lineTo(p.x, p.y)
            ctx.stroke()
          })
        }
      }
    },
  }
}

function particle(x, y, minSpeed, maxSpeed, minLife, maxLife, extra) {
  const a = Math.random() * TAU
  const speed = minSpeed + Math.random() * (maxSpeed - minSpeed)
  const max = minLife + Math.random() * (maxLife - minLife)
  return { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: max, max, ...extra }
}
