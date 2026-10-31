import { PROP_KINDS } from '../maps/parse.ts'
import type { Biome } from '../maps/parse.ts'
import { BIOMES } from '../art/theme.ts'
import { find } from '../dom.ts'
import { drawPreview } from './draw.ts'
import type { PlacingTool, Tool } from './model.ts'

// Tool tiles in the side panel: a picture of each thing you can place, drawn with the real art.
// Blocks are dragged out as rects and depend on the biome; props (and cannons) are dropped onto a surface.
const KEYS: Partial<Record<Tool, string>> = { rock: 'R', water: 'W', concrete: 'K', metal: 'M', cannon: 'C', lamp: 'L' }

// e.code → tool, for keyboard shortcuts. V is the select tool.
// The cast: Object.entries widens KEYS' keys to string.
export const TOOL_KEYS: Partial<Record<string, Tool>> = { KeyV: 'select', ...Object.fromEntries((Object.entries(KEYS) as [Tool, string][]).map(([tool, key]) => [`Key${key}`, tool])) }

// Replaces the tiles; call again when the biome changes.
export function buildPalette(container: HTMLElement, biome: Biome): void {
  container.replaceChildren()
  const groups: [string, readonly PlacingTool[]][] = [
    ['Blocks', BIOMES[biome].blocks],
    ['Props', ['cannon', ...PROP_KINDS]],
  ]
  for (const [title, tools] of groups) {
    const heading = document.createElement('h2')
    heading.textContent = title
    const grid = document.createElement('div')
    grid.className = 'tiles'
    const tiles = tools.map(tile)
    grid.append(...tiles)
    container.append(heading, grid)
    // Draw once laid out: a canvas outside the document has no size.
    tools.forEach((tool, i) => drawPreview(find<HTMLCanvasElement>(tiles[i], 'canvas'), tool, biome))
  }
}

function tile(tool: PlacingTool): HTMLButtonElement {
  const button = document.createElement('button')
  button.dataset.tool = tool
  const shortcut = KEYS[tool]
  button.title = `${label(tool)} tool${shortcut ? ` (${shortcut})` : ''}`
  const canvas = document.createElement('canvas')
  const name = document.createElement('span')
  name.textContent = label(tool)
  if (shortcut) {
    const key = document.createElement('kbd')
    key.textContent = shortcut
    name.append(key)
  }
  button.append(canvas, name)
  return button
}

const label = (tool: string): string => tool[0].toUpperCase() + tool.slice(1)
