import { BaseObject } from "../baseObject.js";

export class MonsterWanderObject extends BaseObject {
  constructor(tileType) {
    super(tileType.MONSTER_WANDER);
    this.tileType = tileType;
  }

  create(dx = 1, dy = 0) {
    if (dx === 0 && dy === 0) {
      return super.create({ dx: 1, dy: 0 });
    }
    return super.create({ dx, dy });
  }

  draw({ ctx, px, py, tileSize }) {
    drawMonster(ctx, px, py, tileSize, "#d86a1f");
  }

  tick({ x, y, world, inBounds, moved, makeEmpty, player, setGameState, random }) {
    const { tileType } = this;
    if (moved[y][x] || world[y][x].type !== tileType.MONSTER_WANDER) {
      return;
    }

    const monster = world[y][x];
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    const preferred = { dx: monster.dx || 1, dy: monster.dy || 0 };
    const candidates = [preferred];
    const start = Math.floor(random() * directions.length);

    for (let i = 0; i < directions.length; i += 1) {
      const direction = directions[(start + i) % directions.length];
      if (direction.dx === preferred.dx && direction.dy === preferred.dy) {
        continue;
      }
      candidates.push(direction);
    }

    for (const direction of candidates) {
      const nx = x + direction.dx;
      const ny = y + direction.dy;
      if (!canMoveTo({ x: nx, y: ny, world, inBounds, tileType, player })) {
        continue;
      }

      moveMonster({ world, fromX: x, fromY: y, toX: nx, toY: ny, makeEmpty, nextDx: direction.dx, nextDy: direction.dy });
      moved[ny][nx] = true;

      if (player.x === nx && player.y === ny) {
        setGameState("lost", "A monster got you. Press R to retry.");
      }
      return;
    }
  }
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
