// Local controls → live { left, right }. Keyboard uses config keys; touch/mouse
// holds the left or right half of the screen. Both at once = both engines.
export function createLocalInput(surface, keys) {
  const state = { left: false, right: false }
  const down = new Set()
  const pointers = new Map() // pointerId → 'left' | 'right'

  const sideOf = (e) => (e.clientX < innerWidth / 2 ? 'left' : 'right')
  function refresh() {
    const sides = [...pointers.values()]
    for (const side of ['left', 'right']) state[side] = keys[side].some((k) => down.has(k)) || sides.includes(side)
  }

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
  addEventListener('blur', () => {
    down.clear()
    pointers.clear()
    refresh()
  })

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
  for (const type of ['pointerup', 'pointercancel']) {
    surface.addEventListener(type, (e) => {
      pointers.delete(e.pointerId)
      refresh()
    })
  }
  surface.addEventListener('contextmenu', (e) => e.preventDefault())

  return state
}
