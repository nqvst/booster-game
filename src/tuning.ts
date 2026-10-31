import type { Config } from './config.ts'
import { byId } from './dom.ts'

// Live tweak panel: press ` (or tap ⚙). Edits mutate config in place; the sim
// reads it every tick. "Copy" gives JSON to paste back into config.ts.
export function createTuningPanel(config: Config): void {
  const panel = byId('tuning')
  const toggle = byId('tune-toggle')

  for (const [section, values] of Object.entries(config)) {
    if (typeof values === 'object') addSection(panel, section, values)
  }
  addCopyButton(panel, config)

  const flip = () => (panel.hidden = !panel.hidden)
  toggle.onclick = flip
  addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') flip()
  })
}

function addSection(panel: HTMLElement, section: string, values: Record<string, unknown>) {
  const keys = Object.keys(values).filter((k) => typeof values[k] === 'number' || typeof values[k] === 'boolean')
  if (!keys.length) return
  const fieldset = panel.appendChild(document.createElement('fieldset'))
  fieldset.appendChild(document.createElement('legend')).textContent = section
  for (const key of keys) addField(fieldset, values, key)
}

// Edits values[key] in place.
function addField(fieldset: HTMLFieldSetElement, values: Record<string, unknown>, key: string) {
  const value = values[key]
  const label = fieldset.appendChild(document.createElement('label'))
  label.append(key)
  const input = label.appendChild(document.createElement('input'))
  if (typeof value === 'boolean') {
    input.type = 'checkbox'
    input.checked = value
    input.onchange = () => (values[key] = input.checked)
    return
  }
  if (typeof value !== 'number') return
  input.type = 'number'
  input.step = String(10 ** (Math.floor(Math.log10(Math.abs(value) || 1)) - 1))
  input.value = String(value)
  input.oninput = () => {
    if (Number.isFinite(input.valueAsNumber)) values[key] = input.valueAsNumber
  }
}

function addCopyButton(panel: HTMLElement, config: Config) {
  const copy = panel.appendChild(document.createElement('button'))
  copy.textContent = 'Copy config JSON'
  copy.onclick = () =>
    navigator.clipboard.writeText(JSON.stringify(config, null, 2)).then(
      () => (copy.textContent = 'Copied'),
      (err) => {
        copy.textContent = 'Copy failed (see console)'
        console.error('Clipboard write failed', err)
      },
    )
}
