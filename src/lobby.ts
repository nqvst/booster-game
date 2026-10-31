import type { LobbyMessage, RoomPlayer } from './net.ts'
import type { Team } from './maps/parse.ts'
import { TEAM } from './art/theme.ts'
import { find } from './dom.ts'
import { otherTeam } from './sim/game.ts'
import { TEAMS } from './maps/parse.ts'

// PvP lobby: who's in and on which team. The host owns the list and sends it to
// joiners as { type: 'lobby', players, mapName } until the match starts.
export const TEAM_SIZE = 4 // maps.test.ts checks every PvP pad has room for this many

type LobbyActions = { onSwitch(id: string): void; onStart(): void; onInvite(event: Event): void }
type LobbyOptions = { localId: string; code: string; actions: LobbyActions | null }

const countOn = (players: RoomPlayer[], team: Team) => players.filter((p) => p.team === team).length

// New players go to the smaller team. null = both teams full.
export function teamFor(players: RoomPlayer[]): Team | null {
  const [smaller] = [...TEAMS].sort((a, b) => countOn(players, a) - countOn(players, b))
  return countOn(players, smaller) < TEAM_SIZE ? smaller : null
}

// Moves a player to the other team if it has room. Returns whether they moved.
export function switchTeam(players: RoomPlayer[], id: string): boolean {
  const player = players.find((p) => p.id === id)
  if (!player || countOn(players, otherTeam(player.team)) >= TEAM_SIZE) return false
  player.team = otherTeam(player.team)
  return true
}

// Host gets the buttons: actions.
export function renderLobby(panel: HTMLElement, lobby: Pick<LobbyMessage, 'players' | 'mapName'>, { localId, code, actions }: LobbyOptions): void {
  panel.hidden = false
  find(panel, '.lobby-room').textContent = `Room ${code} · map ${lobby.mapName}`
  find<HTMLElement>(panel, '.lobby-invite').hidden = !actions
  find<HTMLElement>(panel, '.lobby-start').hidden = !actions
  find<HTMLElement>(panel, '.lobby-wait').hidden = Boolean(actions)
  if (actions) {
    find<HTMLElement>(panel, '.lobby-invite').onclick = actions.onInvite
    find<HTMLElement>(panel, '.lobby-start').onclick = actions.onStart
  }
  const columns = TEAMS.map((team) => teamColumn(team, lobby.players, { localId, actions }))
  find(panel, '.lobby-teams').replaceChildren(...columns)
}

function teamColumn(team: Team, players: RoomPlayer[], { localId, actions }: Omit<LobbyOptions, 'code'>) {
  const section = document.createElement('section')
  section.style.setProperty('--team', TEAM[team].accent)
  const members = players.filter((p) => p.team === team)
  const heading = section.appendChild(document.createElement('h3'))
  heading.textContent = `${TEAM[team].label} ${members.length}/${TEAM_SIZE}`
  const list = section.appendChild(document.createElement('ul'))
  const otherFull = countOn(players, otherTeam(team)) >= TEAM_SIZE
  for (const p of members) list.appendChild(playerRow(p, { you: p.id === localId, actions, otherFull }))
  return section
}

function playerRow(player: RoomPlayer, { you, actions, otherFull }: { you: boolean; actions: LobbyActions | null; otherFull: boolean }) {
  const row = document.createElement('li')
  row.append(player.name + (you ? ' (you)' : ''))
  if (!actions) return row
  const move = row.appendChild(document.createElement('button'))
  move.textContent = player.team === 'blue' ? '→' : '←'
  move.setAttribute('aria-label', `Move ${player.name} to the other team`)
  move.disabled = otherFull
  move.onclick = () => actions.onSwitch(player.id)
  return row
}
