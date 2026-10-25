// Live tweak panel: press ` (or tap ⚙). Edits mutate config in place; the sim
// reads it every tick. "Copy" gives JSON to paste back into config.js.
export function createTuningPanel(config) {
  const panel = document.getElementById('tuning')
  const toggle = document.getElementById('tune-toggle')

  for (const [section, values] of Object.entries(config)) {
    if (typeof values !== 'object') continue
    const fields = Object.entries(values).filter(([, v]) => typeof v === 'number' || typeof v === 'boolean')
    if (!fields.length) continue

    const fieldset = panel.appendChild(document.createElement('fieldset'))
    fieldset.appendChild(document.createElement('legend')).textContent = section
    for (const [key, value] of fields) {
      const label = fieldset.appendChild(document.createElement('label'))
      label.append(key)
      const input = label.appendChild(document.createElement('input'))
      if (typeof value === 'boolean') {
        input.type = 'checkbox'
        input.checked = value
        input.onchange = () => (values[key] = input.checked)
      } else {
        input.type = 'number'
        input.step = 10 ** (Math.floor(Math.log10(Math.abs(value) || 1)) - 1)
        input.value = value
        input.oninput = () => {
          if (Number.isFinite(input.valueAsNumber)) values[key] = input.valueAsNumber
        }
      }
    }
  }

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

  const flip = () => (panel.hidden = !panel.hidden)
  toggle.onclick = flip
  addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') flip()
  })
}
