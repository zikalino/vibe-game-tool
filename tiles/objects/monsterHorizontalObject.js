import { BaseObject } from "../baseObject.js";

export class MonsterHorizontalObject extends BaseObject {
  constructor(tileType) {
    super(tileType.MONSTER_H);
    this.tileType = tileType;
  }

  create(dir = 1) {
    return super.create({ dx: dir >= 0 ? 1 : -1, dy: 0 });
  }

  tick({ x, y, world, inBounds, moved, makeEmpty, player, setGameState }) {
    const { tileType } = this;
    if (moved[y][x] || world[y][x].type !== tileType.MONSTER_H) {
      return;
    }

    const monster = world[y][x];
    const dx = monster.dx >= 0 ? 1 : -1;
    const move = chooseAxisMove({ x, y, world, inBounds, tileType, player, dx, dy: 0, blockedDx: -dx, blockedDy: 0 });
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
  world[toY][toX] = { type: monster.type, dx: nextDx, dy: nextDy };
}
