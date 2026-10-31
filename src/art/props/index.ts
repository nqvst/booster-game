import { drawBeacon, drawLamp, drawStarburst } from './lights.ts'
import { drawRadar, drawSaucer, drawTank } from './machines.ts'
import { drawPalm } from './plants.ts'
import { drawStatue } from './statues.ts'
import type { Point } from '../brush.ts'
import type { Prop, PropKind } from '../../maps/parse.ts'

type PropArt = (ctx: CanvasRenderingContext2D, foot: Point, clock: number) => void

// Props: decoration standing on a surface at x, y. No collision: rockets fly through.
// Art faces right; flip: true mirrors it around x.
// New prop → a draw function in this folder, an entry here and its hit box in boxes.ts,
// its name in PROP_KINDS (maps/parse.ts) and a tile in editor/palette.ts.
export const PROP_ART: Record<PropKind, PropArt> = {
  lamp: drawLamp,
  starburst: drawStarburst,
  beacon: drawBeacon,
  tank: drawTank,
  radar: drawRadar,
  saucer: drawSaucer,
  palm: drawPalm,
  statue: drawStatue,
}

export function drawProp(ctx: CanvasRenderingContext2D, p: Prop, clock: number) {
  const draw = art(p)
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

function art(p: Prop) {
  const a = PROP_ART[p.kind]
  if (!a) throw new Error(`Unknown prop kind "${p.kind}", expected one of ${Object.keys(PROP_ART)}`)
  return a
}
