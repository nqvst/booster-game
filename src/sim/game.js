import { FOOT_Y, NO_INPUT, spawnRocket, stepRocket } from './rocket.js'
import { cannonPedestal, stepBullets, stepCannons } from './cannon.js'

// Pure simulation: no DOM, no randomness, fixed timestep. Same inputs → same
// state, so it can run unchanged on a server or in lockstep between peers.
// All state is plain data (JSON-serializable) for snapshots over the network.

export const FLAG_HEIGHT = 40

// players: [{ id, team }]. Teams come from map.bases.
export function createGame(map, players) {
  const pads = Object.values(map.bases).map((b) => b.pad)
  const game = {
    time: 0,
    winner: null,
    wonAt: null,
    events: [], // this tick only: { type: 'explode' | 'capture', ... }
    map: { ...map, solids: [...map.solids, ...pads, ...map.cannons.map(cannonPedestal)] },
    teams: Object.fromEntries(Object.keys(map.bases).map((team) => [team, { score: 0, flagCarrier: null }])),
    rockets: players.map(({ id, team }, i) => ({
      id,
      team,
      slot: players.slice(0, i).filter((p) => p.team === team).length,
    })),
    cannons: map.cannons.map((c) => ({ ...c, aim: -Math.PI / 2, cooldown: 0 })),
    bullets: [],
  }
  for (const r of game.rockets) spawnRocket(r, map.bases[r.team].pad)
  return game
}

// Foot of the flag pole when the flag is home.
export function flagHome(base) {
  return { x: base.pad.x + base.pad.w / 2, y: base.pad.y }
}

// inputs: { [playerId]: { left, right } }
export function step(game, inputs, config) {
  const dt = 1 / config.tickRate
  game.time += dt
  game.events = []

  for (const rocket of game.rockets) {
    if (!rocket.alive) {
      if (game.time >= rocket.respawnAt) spawnRocket(rocket, game.map.bases[rocket.team].pad)
      continue
    }
    rocket.input = inputs[rocket.id] ?? NO_INPUT
    if (stepRocket(rocket, game.map, config, dt)) kill(game, rocket, config)
  }

  stepCannons(game, config, dt)
  for (const rocket of stepBullets(game, config, dt)) kill(game, rocket, config)
  if (!game.winner) updateFlags(game, config)
}

function kill(game, rocket, config) {
  if (!rocket.alive) return
  rocket.alive = false
  rocket.respawnAt = game.time + config.rules.respawnSeconds
  game.events.push({ type: 'explode', x: rocket.x, y: rocket.y, team: rocket.team })
  // Dropped flag goes straight home.
  for (const team of Object.values(game.teams)) if (team.flagCarrier === rocket.id) team.flagCarrier = null
}

function updateFlags(game, config) {
  const { flagPickupRadius, capturesToWin } = config.rules
  for (const rocket of game.rockets) {
    if (!rocket.alive) continue

    for (const [name, team] of Object.entries(game.teams)) {
      if (name === rocket.team || team.flagCarrier !== null) continue
      const flag = flagHome(game.map.bases[name])
      if (Math.hypot(rocket.x - flag.x, rocket.y - (flag.y - FLAG_HEIGHT / 2)) < flagPickupRadius) {
        team.flagCarrier = rocket.id
      }
    }

    // Capture: land on your own pad with their flag while yours is home.
    const own = game.teams[rocket.team]
    const carried = Object.values(game.teams).find((t) => t.flagCarrier === rocket.id)
    if (carried && own.flagCarrier === null && rocket.landed && onPad(rocket, game.map.bases[rocket.team].pad)) {
      carried.flagCarrier = null
      own.score++
      game.events.push({ type: 'capture', team: rocket.team })
      if (own.score >= capturesToWin) {
        game.winner = rocket.team
        game.wonAt = game.time
      }
    }
  }
}

function onPad(rocket, pad) {
  return rocket.x >= pad.x && rocket.x <= pad.x + pad.w && Math.abs(rocket.y + FOOT_Y - pad.y) < 1
}
