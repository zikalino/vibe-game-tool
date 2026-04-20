export function stepMonsters({ world, rows, cols, inBounds, tileType, makeEmpty, player, setGameState, random }) {
  const moved = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const rand = typeof random === "function" ? random : Math.random;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (moved[y][x] || !isMonster(world[y][x], tileType)) {
        continue;
      }

      const monster = world[y][x];
      const move = chooseMove({ monster, x, y, world, inBounds, tileType, player, random: rand });
      if (!move) {
        continue;
      }

      moveMonster({ world, fromX: x, fromY: y, toX: move.x, toY: move.y, makeEmpty, nextDx: move.dx, nextDy: move.dy });
      moved[move.y][move.x] = true;

      if (player.x === move.x && player.y === move.y) {
        setGameState("lost", "A monster got you. Press R to retry.");
      }
    }
  }
}

function isMonster(tile, tileType) {
  return tile.type === tileType.MONSTER_H || tile.type === tileType.MONSTER_V || tile.type === tileType.MONSTER_WANDER;
}

function chooseMove({ monster, x, y, world, inBounds, tileType, player, random }) {
  if (monster.type === tileType.MONSTER_H) {
    const dx = monster.dx >= 0 ? 1 : -1;
    return chooseAxisMove({ x, y, world, inBounds, tileType, player, dx, dy: 0, blockedDx: -dx, blockedDy: 0 });
  }

  if (monster.type === tileType.MONSTER_V) {
    const dy = monster.dy >= 0 ? 1 : -1;
    return chooseAxisMove({ x, y, world, inBounds, tileType, player, dx: 0, dy, blockedDx: 0, blockedDy: -dy });
  }

  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  const preferredDx = monster.dx || 1;
  const preferredDy = monster.dy || 0;
  const preferred = { dx: preferredDx, dy: preferredDy };
  const rest = directions.filter((direction) => direction.dx !== preferred.dx || direction.dy !== preferred.dy);
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
    if (canMoveTo({ x: nx, y: ny, world, inBounds, tileType, player })) {
      return { x: nx, y: ny, dx: direction.dx, dy: direction.dy };
    }
  }

  return null;
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
