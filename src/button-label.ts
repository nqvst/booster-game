// Button text that says what just happened, then goes back to the button's own label.
const FLASH_SECONDS = 2
const labelTimers = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>()
export function relabel(button: HTMLButtonElement, text: string, { busy = false, ok }: { busy?: boolean; ok?: boolean } = {}) {
  button.dataset.label ??= button.textContent
  clearTimeout(labelTimers.get(button))
  button.textContent = text
  button.disabled = busy
  button.classList.toggle('ok', ok === true)
  button.classList.toggle('failed', ok === false)
}

export function flashLabel(button: HTMLButtonElement, text: string, ok: boolean) {
  relabel(button, text, { ok })
  labelTimers.set(button, setTimeout(() => {
    relabel(button, button.dataset.label ?? text)
    delete button.dataset.label
  }, FLASH_SECONDS * 1000))
}
