import { BaseObject } from "../baseObject.js";

const LAVA_EXPANSION_CHANCE = 0.02;

export class LavaObject extends BaseObject {
  constructor(tileType) {
    super(tileType.LAVA);
    this.tileType = tileType;
  }

  tick({ x, y, world, inBounds, moved, makeLava, random }) {
    const { tileType } = this;
    if (moved[y][x] || world[y][x].type !== tileType.LAVA) {
      return;
    }

    const rand = typeof random === "function" ? random : Math.random;
    if (rand() >= LAVA_EXPANSION_CHANCE) {
      return;
    }

    const emptyNeighbors = [];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) {
        continue;
      }

      if (world[ny][nx].type === tileType.EMPTY) {
        emptyNeighbors.push([nx, ny]);
      }
    }

    if (emptyNeighbors.length === 0) {
      return;
    }

    const index = Math.floor(rand() * emptyNeighbors.length);
    const [nx, ny] = emptyNeighbors[index];
    world[ny][nx] = makeLava();
    moved[ny][nx] = true;
  }
}
