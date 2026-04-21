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

  draw({ ctx, px, py, tileSize }) {
    ctx.fillStyle = "#4a3c13";
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.fillStyle = "#66e8ff";
    ctx.beginPath();
    ctx.moveTo(px + 16, py + 4);
    ctx.lineTo(px + 26, py + 16);
    ctx.lineTo(px + 16, py + 28);
    ctx.lineTo(px + 6, py + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#baf6ff";
    ctx.fillRect(px + 14, py + 9, 4, 4);
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

    if (shouldShatter({ below, gem, tileType })) {
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

function shouldShatter({ below, gem, tileType }) {
  return (below.type === tileType.STONE || below.type === tileType.DIAMOND) && gem.fallDistance >= SHATTER_FALL_DISTANCE;
}

function moveGem({ fromX, fromY, toX, toY, moved, world, makeEmpty, makeDiamond, player, setGameState, fallDistance = 0 }) {
  world[fromY][fromX] = makeEmpty();
  const nextGem = makeDiamond(fallDistance);
  nextGem.transDx = fromX - toX;
  nextGem.transDy = fromY - toY;
  nextGem.transProgress = 1;
  world[toY][toX] = nextGem;
  moved[toY][toX] = true;

  if (player.x === toX && player.y === toY) {
    setGameState("lost", "You were crushed by a gem. Press R to retry.");
  }
}
