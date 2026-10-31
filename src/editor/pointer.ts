import { addCannon, addProp, addRect, edgesNear, forgetIfUnchanged, isPropKind, isRect, itemAt, minSize, placeOnSurface, remember, snap } from './model.ts'
import type { Rect } from '../maps/parse.ts'
import type { Edges, Editor, Point, RectItem, StandingItem, View } from './model.ts'

// Mouse / pen / touch on the map. Select tool: drag to move, drag an edge to resize,
// drag empty space to pan. Block tools: drag out a rect. Cannon and prop tools: click a surface.
// Right or middle drag always pans. Scroll pans, pinch or ctrl+scroll zooms.

const EDGE_PX = 8 // grab distance for resize edges, in screen pixels
const ZOOM_LIMITS = [0.05, 4]
const CURSORS: Partial<Record<string, string>> = { lr: 'ew-resize', tb: 'ns-resize', lt: 'nwse-resize', rb: 'nwse-resize', rt: 'nesw-resize', lb: 'nesw-resize' }

type ResizeDrag = { kind: 'resize'; item: RectItem; start: Rect; edges: Partial<Edges>; created?: boolean }
export type Drag =
  | { kind: 'pan'; from: Point; start: Point }
  | { kind: 'move'; item: RectItem; from: Point; start: Point }
  | { kind: 'stand'; item: StandingItem }
  | ResizeDrag

// onChange(): something moved, the panel may need updating. onHover(worldPoint).
type Listeners = { onChange: () => void; onHover: (p: Point) => void }

export function attachPointer(canvas: HTMLCanvasElement, editor: Editor, { onChange, onHover }: Listeners): void {
  let drag: Drag | null = null

  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId)
    drag = startDrag(editor, e, toWorld(canvas, editor.view, e))
    onChange()
  })
  canvas.addEventListener('pointermove', (e) => {
    const p = toWorld(canvas, editor.view, e)
    onHover(p)
    if (drag) {
      moveDrag(editor, drag, e, p)
      onChange()
    } else {
      canvas.style.cursor = hoverCursor(editor, p)
    }
  })
  const end = () => {
    if (drag) endDrag(editor, drag)
    drag = null
    onChange()
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('wheel', (e) => wheel(canvas, editor.view, e), { passive: false })
}

function startDrag(editor: Editor, e: PointerEvent, p: Point): Drag {
  const pan: Drag = { kind: 'pan', from: { x: e.clientX, y: e.clientY }, start: { ...editor.view } }
  if (e.button !== 0) return pan
  if (editor.tool === 'select') return selectDrag(editor, p) ?? pan
  if (editor.tool === 'cannon') return { kind: 'stand', item: { kind: 'cannon', obj: addCannon(editor, p) } }
  if (isPropKind(editor.tool)) return { kind: 'stand', item: { kind: 'prop', obj: addProp(editor, p, editor.tool) } }
  const rect = addRect(editor, p, editor.tool)
  return { kind: 'resize', item: { kind: 'solid', obj: rect }, start: { ...rect }, edges: { r: true, b: true }, created: true }
}

function selectDrag(editor: Editor, p: Point): Drag | null {
  const { selected } = editor
  const edges = selected && isRect(selected) && edgesNear(selected.obj, p, EDGE_PX / editor.view.zoom)
  if (edges) {
    remember(editor)
    return { kind: 'resize', item: selected, start: { ...selected.obj }, edges }
  }
  const item = itemAt(editor.map, p)
  editor.selected = item
  if (!item) return null
  remember(editor)
  if (!isRect(item)) return { kind: 'stand', item }
  return { kind: 'move', item, from: p, start: { x: item.obj.x, y: item.obj.y } }
}

function moveDrag(editor: Editor, drag: Drag, e: PointerEvent, p: Point): void {
  if (drag.kind === 'pan') {
    editor.view.x = drag.start.x - (e.clientX - drag.from.x) / editor.view.zoom
    editor.view.y = drag.start.y - (e.clientY - drag.from.y) / editor.view.zoom
  }
  if (drag.kind === 'move') Object.assign(drag.item.obj, { x: snap(drag.start.x + p.x - drag.from.x), y: snap(drag.start.y + p.y - drag.from.y) })
  if (drag.kind === 'stand') placeOnSurface(editor.map, drag.item.obj, p)
  if (drag.kind === 'resize') resize(drag, p)
}

// Edges follow the pointer; dragging past the opposite edge flips the rect.
function resize({ item, start, edges, created }: ResizeDrag, p: Point): void {
  let [l, r, t, b] = [start.x, start.x + start.w, start.y, start.y + start.h]
  if (edges.l) l = snap(p.x)
  if (edges.r) r = snap(p.x)
  if (edges.t) t = snap(p.y)
  if (edges.b) b = snap(p.y)
  const min = created ? { w: 0, h: 0 } : minSize(item)
  Object.assign(item.obj, { x: Math.min(l, r), y: Math.min(t, b), w: Math.max(Math.abs(r - l), min.w), h: Math.max(Math.abs(b - t), min.h) })
}

// A click with a rect tool (no drag) leaves a zero-size rect: drop it.
function endDrag(editor: Editor, drag: Drag): void {
  if (drag.kind === 'pan') return
  if (drag.kind === 'resize' && drag.created && (drag.item.obj.w === 0 || drag.item.obj.h === 0)) {
    editor.map.solids.splice(editor.map.solids.indexOf(drag.item.obj), 1)
    editor.selected = null
  }
  forgetIfUnchanged(editor)
}

function hoverCursor(editor: Editor, p: Point): string {
  const { selected, tool, view } = editor
  if (tool !== 'select') return 'crosshair'
  const edges = selected && isRect(selected) && edgesNear(selected.obj, p, EDGE_PX / view.zoom)
  if (edges) return CURSORS[Object.entries(edges).filter(([, near]) => near).map(([k]) => k).join('')] ?? 'move'
  return itemAt(editor.map, p) ? 'move' : 'grab'
}

function wheel(canvas: HTMLCanvasElement, view: View, e: WheelEvent): void {
  e.preventDefault()
  if (!e.ctrlKey && !e.metaKey) {
    view.x += e.deltaX / view.zoom
    view.y += e.deltaY / view.zoom
    return
  }
  // Zoom around the pointer: the world point under it stays put.
  const before = toWorld(canvas, view, e)
  view.zoom = Math.min(Math.max(view.zoom * Math.exp(-e.deltaY * 0.01), ZOOM_LIMITS[0]), ZOOM_LIMITS[1])
  const after = toWorld(canvas, view, e)
  view.x += before.x - after.x
  view.y += before.y - after.y
}

// view.x, view.y: world point at the canvas center. zoom: CSS pixels per world unit.
export function toWorld(canvas: HTMLCanvasElement, view: View, e: MouseEvent): Point {
  const box = canvas.getBoundingClientRect()
  return { x: view.x + (e.clientX - box.left - box.width / 2) / view.zoom, y: view.y + (e.clientY - box.top - box.height / 2) / view.zoom }
}
