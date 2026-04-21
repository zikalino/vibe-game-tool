export const TileType = {
  EMPTY: "empty",
  STONE: "stone",
  SOIL: "soil",
  WATER: "water",
  ROCK: "rock",
  DIAMOND: "diamond",
  LAVA: "lava",
  MONSTER_H: "monster_h",
  MONSTER_V: "monster_v",
  MONSTER_WANDER: "monster_wander",
  GOAL: "goal",
};

export function makeEmpty() {
  return { type: TileType.EMPTY };
}

export function makeStone() {
  return { type: TileType.STONE };
}

export function makeSoil() {
  return { type: TileType.SOIL };
}

export function makeWater(amount) {
  return { type: TileType.WATER, water: amount };
}

export function makeRock(charge = 0, vx = 0) {
  return { type: TileType.ROCK, charge: Math.max(0, charge), vx };
}

export function makeDiamond() {
  return { type: TileType.DIAMOND };
}

export function makeLava() {
  return { type: TileType.LAVA };
}

export function makeMonsterHorizontal(dir = 1) {
  return { type: TileType.MONSTER_H, dx: dir >= 0 ? 1 : -1, dy: 0 };
}

export function makeMonsterVertical(dir = 1) {
  return { type: TileType.MONSTER_V, dx: 0, dy: dir >= 0 ? 1 : -1 };
}

export function makeMonsterWander(dx = 1, dy = 0) {
  if (dx === 0 && dy === 0) {
    return { type: TileType.MONSTER_WANDER, dx: 1, dy: 0 };
  }
  return { type: TileType.MONSTER_WANDER, dx, dy };
}

export function makeGoal() {
  return { type: TileType.GOAL };
}

export function canHoldWater(tile) {
  return tile.type === TileType.EMPTY || tile.type === TileType.WATER;
}

export function getWaterAmount(tile) {
  return tile.type === TileType.WATER ? tile.water : 0;
}
