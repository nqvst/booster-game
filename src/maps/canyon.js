// Co-op vs CPU: blue (players) steal red's flag. Red has only AA cannons.
// Rects are { x, y, w, h } with y pointing down. Cannon x,y = the surface it stands on.
export const canyon = {
  width: 3200,
  height: 1400,
  solids: [
    { x: 0, y: 1300, w: 3200, h: 100 }, // ground
    { x: 700, y: 820, w: 220, h: 40 }, // floating slab
    { x: 1300, y: 1050, w: 600, h: 250 }, // mountain
    { x: 1420, y: 900, w: 360, h: 150 },
    { x: 1520, y: 820, w: 160, h: 80 },
    { x: 2350, y: 950, w: 320, h: 50 }, // overhang
    { x: 2700, y: 1100, w: 60, h: 200 }, // pillar guarding red base
  ],
  bases: {
    blue: { pad: { x: 120, y: 1240, w: 240, h: 60 } },
    red: { pad: { x: 2840, y: 1240, w: 240, h: 60 } },
  },
  cannons: [
    { x: 2510, y: 950, team: 'red' }, // on the overhang
  ],
}
