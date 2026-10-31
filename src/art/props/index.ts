import { drawBeacon, drawLamp, drawStarburst } from './lights.ts'
import { drawRadar, drawSaucer, drawTank } from './machines.ts'
import { drawPalm } from './plants.ts'
import { drawStatue } from './statues.ts'
import type { Point } from '../brush.ts'
import type { Prop, PropKind } from '../../maps/parse.ts'

export type PropArt = {
  draw: (ctx: CanvasRenderingContext2D, foot: Point, clock: number) => void
  box: { l: number; r: number; h: number }
}

// Props: decoration standing on a surface at x, y. No collision: rockets fly through.
// Art faces right; flip: true mirrors it around x. box: how far the art reaches left,
// right and up from the foot, for the editor's hit box.
// New prop → a draw function in this folder, an entry here, its name in PROP_KINDS
// (maps/parse.ts) and a tile in editor/palette.ts.
export const PROP_ART: Record<PropKind, PropArt> = {
  lamp: { draw: drawLamp, box: { l: 6, r: 27, h: 68 } },
  starburst: { draw: drawStarburst, box: { l: 16, r: 16, h: 66 } },
  beacon: { draw: drawBeacon, box: { l: 8, r: 8, h: 24 } },
  tank: { draw: drawTank, box: { l: 17, r: 17, h: 48 } },
  radar: { draw: drawRadar, box: { l: 16, r: 16, h: 70 } },
  saucer: { draw: drawSaucer, box: { l: 36, r: 36, h: 34 } },
  palm: { draw: drawPalm, box: { l: 20, r: 22, h: 50 } },
  statue: { draw: drawStatue, box: { l: 18, r: 18, h: 58 } },
}

export function drawProp(ctx: CanvasRenderingContext2D, p: Prop, clock: number) {
  const { draw } = art(p)
  if (!p.flip) {
    draw(ctx, p, clock)
    return
  }
  ctx.save()
  ctx.translate(p.x * 2, 0)
  ctx.scale(-1, 1)
  draw(ctx, p, clock)
  ctx.restore()
}

export function propBounds(p: Prop) {
  const { l, r, h } = art(p).box
  return { x: p.x - (p.flip ? r : l), y: p.y - h, w: l + r, h }
}

function art(p: Prop) {
  const a = PROP_ART[p.kind]
  if (!a) throw new Error(`Unknown prop kind "${p.kind}", expected one of ${Object.keys(PROP_ART)}`)
  return a
}
