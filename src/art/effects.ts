import { COLOR, TEAM } from './theme.ts'
import { TAU, additive, glowDot, rand } from './brush.ts'
import type { Point } from './brush.ts'
import type { GameEvent } from '../sim/game.ts'

export type Explosion = Omit<Extract<GameEvent, { type: 'explode' }>, 'type'>

type MinMax = [min: number, max: number]
type Look = { gravity: number; size: number } & ({ kind: 'smoke' | 'flash' } | { kind: 'spark'; color: string })
type Particle = Look & { x: number; y: number; vx: number; vy: number; life: number; max: number }

// Explosions: smoke under, flash + sparks on top. Render-only, so Math.random is fine.
export function createEffects() {
  let particles: Particle[] = []

  return {
    explode(at: Explosion) {
      particles.push(...burst(at))
    },

    draw(ctx: CanvasRenderingContext2D, dt: number) {
      particles = particles.filter((p) => {
        p.life -= dt
        return p.life > 0
      })
      for (const p of particles) {
        move(p, dt)
        const t = p.life / p.max // 1 → 0
        if (p.kind === 'spark') DRAW.spark(ctx, p, t)
        else DRAW[p.kind](ctx, p, t)
      }
    },
  }
}

function burst({ x, y, team }: Explosion) {
  const at = { x, y }
  const smoke = Array.from({ length: 12 }, () =>
    particle(at, [20, 80], [1.2, 2], { kind: 'smoke', gravity: -30, size: 6 + Math.random() * 6 }),
  )
  const flash: Particle = { x, y, vx: 0, vy: 0, life: 0.25, max: 0.25, kind: 'flash', gravity: 0, size: 60 }
  const sparks = Array.from({ length: 40 }, (_, i) =>
    particle(at, [80, 380], [0.4, 1], {
      kind: 'spark',
      gravity: 200,
      size: 1.5 + Math.random() * 1.5,
      color: i % 4 ? COLOR.spark[i % 3] : TEAM[team].accent,
    }),
  )
  return [...smoke, flash, ...sparks]
}

function move(moving: Particle, dt: number) {
  moving.vy += moving.gravity * dt
  if (moving.kind === 'smoke') moving.vx *= 1 - 1.5 * dt
  moving.x += moving.vx * dt
  moving.y += moving.vy * dt
}

const DRAW = {
  smoke(ctx: CanvasRenderingContext2D, puff: Particle, lifeLeft: number) {
    ctx.globalAlpha = lifeLeft * 0.45
    ctx.fillStyle = COLOR.smoke
    ctx.beginPath()
    ctx.arc(puff.x, puff.y, puff.size * (2 - lifeLeft), 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
  },
  flash(ctx: CanvasRenderingContext2D, flash: Particle, lifeLeft: number) {
    additive(ctx, () => glowDot(ctx, flash.x, flash.y, {
      radius: flash.size * (1.6 - lifeLeft),
      color: COLOR.spark[0],
      alpha: lifeLeft,
    }))
  },
  spark(ctx: CanvasRenderingContext2D, spark: Extract<Particle, { kind: 'spark' }>, lifeLeft: number) {
    additive(ctx, () => {
      ctx.globalAlpha = lifeLeft
      ctx.strokeStyle = spark.color
      ctx.lineWidth = spark.size
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(spark.x - spark.vx * 0.03, spark.y - spark.vy * 0.03)
      ctx.lineTo(spark.x, spark.y)
      ctx.stroke()
    })
  },
}

function particle({ x, y }: Point, speed: MinMax, life: MinMax, extra: Look): Particle {
  const a = Math.random() * TAU
  const v = rand(...speed)
  const max = rand(...life)
  return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max, ...extra }
}
