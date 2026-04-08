export const TileType = {
  EMPTY: "empty",
  STONE: "stone",
  SOIL: "soil",
  WATER: "water",
  ROCK: "rock",
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

export function makeRock() {
  return { type: TileType.ROCK };
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
