// The whole look in one place: cream plastic hulls, orange trim, dusk canyon,
// glowing laser bolts. Tweak here and check /art.html (npm run dev).

const GUNMETAL = ['#c9ccd2', '#8d929b', '#4a4e57'] // light, mid, shadow

export const TEAM = {
  blue: { label: 'ORANGE', accent: '#ff7a1a', hull: ['#fffaf0', '#efe2c4', '#a8977a'], laser: '#ff3b2f' },
  red: { label: 'RED', accent: '#e0312b', hull: GUNMETAL, laser: '#3dff5a' },
}

export const COLOR = {
  outline: '#2a2420',
  cream: '#f6eedb',
  creamShade: '#cdbf9f',
  gunmetal: GUNMETAL,
  metalDark: '#23262c',
  legs: '#6b6560',
  canopy: '#1b2230',
  canopyGlint: 'rgba(170,225,255,0.75)',
  gloss: 'rgba(255,255,255,0.5)',
  panelLine: 'rgba(60,45,30,0.35)',
  flame: ['rgba(255,255,235,1)', 'rgba(255,160,60,0.9)', 'rgba(255,60,20,0)'], // nozzle → tip

  void: '#120c0c', // outside the map
  sky: [[0, '#05061a'], [0.45, '#1e1838'], [0.72, '#6a3346'], [0.88, '#d46a3c'], [1, '#ffb36b']],
  star: '#fff6e0',
  sun: '#fff4d6',
  sunGlow: '#ffb060',
  mesas: ['#3d2740', '#5e3236'], // far → near
  rock: ['#c98a55', '#9a5a36', '#6e3c26'], // lit top → base
  rockLip: '#e8b07a',
  strata: 'rgba(0,0,0,0.12)',

  spark: ['#fff1c2', '#ffb347', '#ff6a1f'],
  smoke: '#2e2422',

  text: '#fff3dc',
  textDim: 'rgba(255,243,220,0.55)',
}

export const FONT = '"Avenir Next", Futura, "Segoe UI", system-ui, sans-serif'
