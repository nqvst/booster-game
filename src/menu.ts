import type { Config } from './config.ts'
import type { Mode, Team } from './maps/parse.ts'
import { SKIES } from './art/theme.ts'
import { context2d, find } from './dom.ts'
import { fitCanvas } from './art/brush.ts'
import { drawFlag, drawPad } from './art/scenery.ts'
import { drawRock } from './art/solids.ts'
import { drawCannon } from './art/sprites.ts'

// Start screen: pick a name, then PvE or PvP. Opened from an invite link it offers Join instead.
// Mode pictures are drawn live with the game's own art.

const NAME_KEY = 'booster-name'
const SKY = SKIES.dusk
const PICTURE = { w: 220, h: 96 } // world units shown in a mode card
const GROUND_Y = 76

type MenuOptions = {
  joinCode: string // set → only Join is offered
  rules: Config['rules']
  handlers: { onPick(mode: Mode, name: string): void; onJoin(name: string): void }
}

export function showMenu(panel: HTMLElement, { joinCode, rules, handlers }: MenuOptions): void {
  const nameInput = find<HTMLInputElement>(panel, '#player-name')
  nameInput.value = loadName()
  const name = () => {
    saveName(nameInput.value)
    return nameInput.value
  }
  find<HTMLElement>(panel, '.menu-modes').hidden = Boolean(joinCode)
  find(panel, '.menu-pve-rules').textContent =
    `Co-op vs the computer. Steal its flag ${rules.capturesToWin}× before its turrets shoot you down ${rules.cpuKillsToWin}×.`
  const joinButton = find<HTMLElement>(panel, '.menu-join')
  joinButton.hidden = !joinCode
  joinButton.textContent = `Join room ${joinCode}`
  joinButton.onclick = () => handlers.onJoin(name())
  for (const card of panel.querySelectorAll<HTMLElement>('[data-mode]')) card.onclick = () => handlers.onPick(card.dataset.mode as Mode, name())
  panel.hidden = false
  animatePictures(panel)
}

function animatePictures(panel: HTMLElement) {
  const pictures = [...panel.querySelectorAll<HTMLCanvasElement>('[data-mode] canvas')]
  requestAnimationFrame(function frame(now) {
    if (panel.hidden) return
    for (const canvas of pictures) drawPicture(canvas, canvas.closest<HTMLElement>('[data-mode]')?.dataset.mode, now / 1000)
    requestAnimationFrame(frame)
  })
}

// PvE: the computer's flag and a turret. PvP: a flag on each side.
function drawPicture(canvas: HTMLCanvasElement, mode: string | undefined, clock: number) {
  const ctx = context2d(canvas)
  const { w, h } = fitCanvas(canvas)
  const scale = Math.min(w / PICTURE.w, h / PICTURE.h)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  for (const [at, color] of SKY.sky) sky.addColorStop(at, color)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  ctx.setTransform(scale, 0, 0, scale, (w - PICTURE.w * scale) / 2, (h - PICTURE.h * scale) / 2)
  drawRock(ctx, { x: -40, y: GROUND_Y, w: PICTURE.w + 80, h: 60 }, SKY, 'desert')
  if (mode === 'pvp') {
    drawBase(ctx, 10, 'blue', clock)
    drawBase(ctx, PICTURE.w - 100, 'red', clock)
    return
  }
  drawBase(ctx, 20, 'red', clock)
  const aim = -Math.PI / 2 - 0.5 + Math.sin(clock * 0.8) * 0.35
  drawCannon(ctx, { x: 165, y: GROUND_Y, team: 'red', aim }, clock % 1.6 < 0.08, clock)
}

function drawBase(ctx: CanvasRenderingContext2D, x: number, team: Team, clock: number) {
  const pad = { x, y: GROUND_Y - 14, w: 90, h: 14 }
  drawPad(ctx, pad, team, clock)
  drawFlag(ctx, { x: x + pad.w / 2, y: pad.y }, team, clock)
}

// Remembering the name is a convenience: storage can be blocked (private mode), the game works without it.
export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch (err) {
    console.warn('Could not read saved name', err)
    return ''
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch (err) {
    console.warn('Could not save name', err)
  }
}
