import type { Prop, PropKind, Rect } from '../../maps/parse.ts'

// How far each prop's art reaches left, right and up from its foot, for the editor's hit box.
// Separate from the drawing code so the editor's no-DOM model can use it.
const PROP_BOXES: Record<PropKind, { l: number; r: number; h: number }> = {
  lamp: { l: 6, r: 27, h: 68 },
  starburst: { l: 16, r: 16, h: 66 },
  beacon: { l: 8, r: 8, h: 24 },
  tank: { l: 17, r: 17, h: 48 },
  radar: { l: 16, r: 16, h: 70 },
  saucer: { l: 36, r: 36, h: 34 },
  palm: { l: 20, r: 22, h: 50 },
  statue: { l: 18, r: 18, h: 58 },
}

export function propBounds(prop: Prop): Rect {
  const { l, r, h } = PROP_BOXES[prop.kind]
  return { x: prop.x - (prop.flip ? r : l), y: prop.y - h, w: l + r, h }
}
