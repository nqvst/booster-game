import type { Config } from './config.ts'
import type { Input } from './sim/rocket.ts'

type Side = keyof Input
type Pointers = Map<number, Side> // by pointerId

// Local controls → live { left, right }. Keyboard uses config keys; touch/mouse
// holds the left or right half of the screen. Both at once = both engines.
export function createLocalInput(surface: HTMLElement, keys: Config['keys']): Input {
  const state: Input = { left: false, right: false }
  const down = new Set<string>()
  const pointers: Pointers = new Map()

  function refresh() {
    const sides = [...pointers.values()]
    for (const side of ['left', 'right'] as const) state[side] = keys[side].some((k) => down.has(k)) || sides.includes(side)
  }

  listenKeys(down, refresh)
  listenPointers(surface, pointers, refresh)
  addEventListener('blur', () => {
    down.clear()
    pointers.clear()
    refresh()
  })
  return state
}

function listenKeys(down: Set<string>, refresh: () => void) {
  addEventListener('keydown', (e) => {
    down.add(e.code)
    refresh()
  })
  addEventListener('keyup', (e) => {
    down.delete(e.code)
    // Windows can drop the keyup of the first Shift released while both are held; once no Shift is down, clear both.
    if (e.key === 'Shift' && !e.shiftKey) {
      down.delete('ShiftLeft')
      down.delete('ShiftRight')
    }
    refresh()
  })
}

function listenPointers(surface: HTMLElement, pointers: Pointers, refresh: () => void) {
  const sideOf = (e: PointerEvent): Side => (e.clientX < innerWidth / 2 ? 'left' : 'right')
  surface.addEventListener('pointerdown', (e) => {
    surface.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, sideOf(e))
    refresh()
  })
  surface.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, sideOf(e))
    refresh()
  })
  for (const type of ['pointerup', 'pointercancel'] as const) {
    surface.addEventListener(type, (e) => {
      pointers.delete(e.pointerId)
      refresh()
    })
  }
  surface.addEventListener('contextmenu', (e) => e.preventDefault())
}
