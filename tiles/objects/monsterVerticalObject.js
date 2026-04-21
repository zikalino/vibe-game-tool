import { BaseObject } from "../baseObject.js";

export class MonsterVerticalObject extends BaseObject {
  constructor(tileType) {
    super(tileType.MONSTER_V);
    this.tileType = tileType;
  }

  create(dir = 1) {
    return super.create({ dx: 0, dy: dir >= 0 ? 1 : -1 });
  }

  draw({ ctx, px, py, tileSize }) {
    drawMonster(ctx, px, py, tileSize, "#2ea55f");
  }

  tick({ x, y, world, inBounds, moved, makeEmpty, player, setGameState }) {
    const { tileType } = this;
    if (moved[y][x] || world[y][x].type !== tileType.MONSTER_V) {
      return;
    }

    const monster = world[y][x];
    const dy = monster.dy >= 0 ? 1 : -1;
    const move = chooseAxisMove({ x, y, world, inBounds, tileType, player, dx: 0, dy, blockedDx: 0, blockedDy: -dy });
    if (!move) {
      return;
    }

    moveMonster({ world, fromX: x, fromY: y, toX: move.x, toY: move.y, makeEmpty, nextDx: move.dx, nextDy: move.dy });
    moved[move.y][move.x] = true;

    if (player.x === move.x && player.y === move.y) {
      setGameState("lost", "A monster got you. Press R to retry.");
    }
  }
}

function chooseAxisMove({ x, y, world, inBounds, tileType, player, dx, dy, blockedDx, blockedDy }) {
  const nx = x + dx;
  const ny = y + dy;
  if (canMoveTo({ x: nx, y: ny, world, inBounds, tileType, player })) {
    return { x: nx, y: ny, dx, dy };
  }

  const bx = x + blockedDx;
  const by = y + blockedDy;
  if (canMoveTo({ x: bx, y: by, world, inBounds, tileType, player })) {
    return { x: bx, y: by, dx: blockedDx, dy: blockedDy };
  }

  return null;
}

function canMoveTo({ x, y, world, inBounds, tileType, player }) {
  if (!inBounds(x, y)) {
    return false;
  }
  if (player.x === x && player.y === y) {
    return true;
  }
  const tile = world[y][x];
  return tile.type === tileType.EMPTY;
}

function moveMonster({ world, fromX, fromY, toX, toY, makeEmpty, nextDx, nextDy }) {
  const monster = world[fromY][fromX];
  world[fromY][fromX] = makeEmpty();
  world[toY][toX] = {
    type: monster.type,
    dx: nextDx,
    dy: nextDy,
    transDx: fromX - toX,
    transDy: fromY - toY,
    transProgress: 1,
  };
}

function drawMonster(ctx, px, py, tileSize, bodyColor) {
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(px + tileSize / 2, py + tileSize / 2, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(px + 10, py + 10, 4, 4);
  ctx.fillRect(px + 18, py + 10, 4, 4);
  ctx.fillStyle = "#111";
  ctx.fillRect(px + 11, py + 11, 2, 2);
  ctx.fillRect(px + 19, py + 11, 2, 2);
}
