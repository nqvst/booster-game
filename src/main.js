import { config } from './config.js'
import { canyon } from './maps/canyon.js'
import { createGame, step } from './sim/game.js'
import { createLocalInput } from './input.js'
import { createRenderer } from './render.js'
import { createTuningPanel } from './tuning.js'

const LOCAL_ID = 'p1'
// Co-op vs CPU. With networking, more blue (or red, for PvP) players join here.
const PLAYERS = [{ id: LOCAL_ID, team: 'blue' }]
const RESTART_DELAY = 4

const canvas = document.querySelector('canvas')
const input = createLocalInput(canvas, config.keys)
const draw = createRenderer(canvas, config)
createTuningPanel(config)

let game = createGame(canyon, PLAYERS)
let last = performance.now()
let pending = 0

requestAnimationFrame(function frame(now) {
  const elapsed = Math.min((now - last) / 1000, 0.25) // a backgrounded tab shouldn't fast-forward
  last = now
  pending += elapsed

  // Fixed-step sim; each tick gets an input snapshot (what a network layer would send).
  const tick = 1 / config.tickRate
  const events = []
  while (pending >= tick) {
    step(game, { [LOCAL_ID]: { left: input.left, right: input.right } }, config)
    events.push(...game.events)
    pending -= tick
  }

  draw(game, LOCAL_ID, events, elapsed)
  if (game.winner && game.time - game.wonAt > RESTART_DELAY) game = createGame(canyon, PLAYERS)
  requestAnimationFrame(frame)
})
