import assert from 'node:assert/strict'
import { config as baseConfig } from '../src/config.js'
import { createGame, flagHome, step } from '../src/sim/game.js'

const flat = {
  width: 2000,
  height: 1000,
  solids: [{ x: 0, y: 900, w: 2000, h: 100 }],
  bases: { blue: { pad: { x: 100, y: 860, w: 240, h: 40 } }, red: { pad: { x: 1600, y: 860, w: 240, h: 40 } } },
  cannons: [],
}
const BOTH = { left: true, right: true }

function setup(map = flat, tweak = () => {}) {
  const config = structuredClone(baseConfig)
  tweak(config)
  const game = createGame(map, [{ id: 'p1', team: 'blue' }])
  return { config, game, r: game.rockets[0] }
}
function run({ game, config }, seconds, input = {}) {
  for (let i = 0; i < seconds * config.tickRate; i++) step(game, { p1: input }, config)
}
function runUntil({ game, config }, done, seconds) {
  for (let i = 0; i < seconds * config.tickRate; i++) {
    step(game, {}, config)
    if (done()) return true
  }
  return false
}

// Both engines: straight up.
{
  const t = setup()
  const y0 = t.r.y
  run(t, 0.5, BOTH)
  assert(t.r.alive && t.r.y < y0 - 20 && t.r.angle === 0, 'both engines should lift straight up')
}

// Left engine tilts nose right; engines further out spin faster.
{
  const tilt = (offset) => {
    const t = setup(flat, (c) => (c.rocket.engineOffset = offset))
    run(t, 0.3, BOTH)
    run(t, 0.2, { left: true })
    assert(t.r.alive, `rocket crashed during tilt test (offset ${offset})`)
    return t.r.angle
  }
  assert(tilt(8) > 0, 'left engine should rotate clockwise')
  assert(tilt(20) > tilt(8), 'larger engineOffset should spin faster')
}

// Soft landing survives.
{
  const t = setup()
  Object.assign(t.r, { x: 1000, y: 900 - 18 - 10, landed: false })
  run(t, 1)
  assert(t.r.alive && t.r.landed, 'gentle drop should land')
}

// Slight lean while drifting sideways still lands.
{
  const t = setup()
  Object.assign(t.r, { x: 1000, y: 870, angle: 0.3, vx: 150, vy: 120, landed: false })
  run(t, 0.5)
  assert(t.r.alive && t.r.landed, 'leaning, drifting landing should survive')
}

// Heavily tilted landing crashes.
{
  const t = setup()
  Object.assign(t.r, { x: 1000, y: 870, angle: 0.8, landed: false })
  assert(runUntil(t, () => !t.r.alive, 1), 'tilted landing should crash')
}

// Hard landing crashes, respawns after respawnSeconds.
{
  const t = setup()
  Object.assign(t.r, { x: 1000, y: 500, landed: false })
  assert(runUntil(t, () => !t.r.alive, 3), 'fast drop should crash')
  const deadAt = t.game.time
  assert(runUntil(t, () => t.r.alive, 5), 'should respawn')
  assert(Math.abs(t.game.time - deadAt - t.config.rules.respawnSeconds) < 0.02, 'respawn delay')
  assert(t.r.landed && t.r.x < 340, 'respawn on own pad')
}

// Capture the flag; dying with the flag returns it.
{
  const t = setup()
  const enemyFlag = flagHome(flat.bases.red)
  const ownPad = flat.bases.blue.pad
  const grab = () => {
    Object.assign(t.r, { x: enemyFlag.x, y: enemyFlag.y - 20, vx: 0, vy: 0 })
    step(t.game, {}, t.config)
    assert.equal(t.game.teams.red.flagCarrier, 'p1', 'should pick up enemy flag')
  }
  grab()
  Object.assign(t.r, { x: ownPad.x + 40, y: ownPad.y - 18 })
  step(t.game, {}, t.config)
  assert.equal(t.game.teams.blue.score, 1, 'landing on own pad with flag scores')
  assert.equal(t.game.teams.red.flagCarrier, null, 'flag returns after capture')

  grab()
  t.r.vy = 2000
  assert(runUntil(t, () => !t.r.alive, 1), 'should crash')
  assert.equal(t.game.teams.red.flagCarrier, null, 'flag returns when carrier dies')
}

// Cannon shoots down a rocket in range.
{
  const t = setup({ ...flat, cannons: [{ x: 1000, y: 900, team: 'red' }] }, (c) => (c.cannon.enabled = true))
  Object.assign(t.r, { x: 1400, y: 900 - 18 })
  assert(runUntil(t, () => !t.r.alive, 6), 'cannon should hit rocket in range')
}

console.log('sim ok')
