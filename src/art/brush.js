// Small painting helpers shared by the art files.

export const TAU = Math.PI * 2

// Lit-from-the-left cylinder shading across x0..x1. stops = [light, mid, shadow].
export function shaded(ctx, x0, x1, [light, mid, shadow]) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0)
  g.addColorStop(0, mid)
  g.addColorStop(0.3, light)
  g.addColorStop(1, shadow)
  return g
}

// Draws inside with additive blending, so overlapping light glows.
export function additive(ctx, draw) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  draw()
  ctx.restore()
}

// Soft round light. Use inside additive().
export function glowDot(ctx, x, y, radius, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalAlpha = alpha
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
}
