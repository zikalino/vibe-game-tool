import { BaseObject } from "../baseObject.js";

const SHATTER_FALL_DISTANCE = 3;

export class GemObject extends BaseObject {
  constructor(tileType) {
    super(tileType.DIAMOND);
    this.tileType = tileType;
  }

  create(fallDistance = 0) {
    return super.create({ fallDistance: Math.max(0, fallDistance) });
  }

  tick({ x, y, world, inBounds, moved, makeEmpty, makeDiamond, player, setGameState, rollDirs }) {
    const { tileType } = this;
    if (moved[y][x] || world[y][x].type !== tileType.DIAMOND) {
      return;
    }

    const gem = world[y][x];
    const below = world[y + 1][x];

    if (below.type === tileType.EMPTY) {
      moveGem({
        fromX: x,
        fromY: y,
        toX: x,
        toY: y + 1,
        moved,
        world,
        makeEmpty,
        makeDiamond,
        player,
        setGameState,
        fallDistance: gem.fallDistance + 1,
      });
      return;
    }

    if ((below.type === tileType.STONE || below.type === tileType.DIAMOND) && gem.fallDistance >= SHATTER_FALL_DISTANCE) {
      world[y][x] = makeEmpty();
      return;
    }

    if (!isGemSupport(below, tileType)) {
      world[y][x] = makeDiamond(0);
      return;
    }

    for (const dx of rollDirs) {
      const nx = x + dx;
      const ny = y + 1;
      if (!inBounds(nx, y) || !inBounds(nx, ny)) {
        continue;
      }

      if (world[y][nx].type !== tileType.EMPTY || world[ny][nx].type !== tileType.EMPTY) {
        continue;
      }

      moveGem({
        fromX: x,
        fromY: y,
        toX: nx,
        toY: ny,
        moved,
        world,
        makeEmpty,
        makeDiamond,
        player,
        setGameState,
        fallDistance: gem.fallDistance + 1,
      });
      return;
    }

    world[y][x] = makeDiamond(0);
  }
}

function isGemSupport(tile, tileType) {
  return tile.type === tileType.STONE || tile.type === tileType.ROCK || tile.type === tileType.DIAMOND;
}

function moveGem({ fromX, fromY, toX, toY, moved, world, makeEmpty, makeDiamond, player, setGameState, fallDistance = 0 }) {
  world[fromY][fromX] = makeEmpty();
  world[toY][toX] = makeDiamond(fallDistance);
  moved[toY][toX] = true;

  if (player.x === toX && player.y === toY) {
    setGameState("lost", "You were crushed by a falling gem. Press R to retry.");
  }
}
