export function stepRocks({ world, rows, cols, inBounds, tileType, makeEmpty, makeRock, player, setGameState, rollBias }) {
  const moved = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const rollDirs = rollBias > 0 ? [1, -1] : [-1, 1];
  let nextRollBias = -rollBias;

  for (let y = rows - 2; y >= 0; y -= 1) {
    for (let x = 0; x < cols; x += 1) {
      if (moved[y][x] || world[y][x].type !== tileType.ROCK) {
        continue;
      }

      const below = world[y + 1][x];
      if (below.type === tileType.EMPTY) {
        moveRock({
          fromX: x,
          fromY: y,
          toX: x,
          toY: y + 1,
          moved,
          world,
          makeEmpty,
          makeRock,
          player,
          setGameState,
        });
        continue;
      }

      if (!isRockSupport(below, tileType)) {
        continue;
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

        moveRock({
          fromX: x,
          fromY: y,
          toX: nx,
          toY: ny,
          moved,
          world,
          makeEmpty,
          makeRock,
          player,
          setGameState,
        });
        break;
      }
    }
  }

  return nextRollBias;
}

function isRockSupport(tile, tileType) {
  return tile.type === tileType.STONE || tile.type === tileType.ROCK;
}

function moveRock({ fromX, fromY, toX, toY, moved, world, makeEmpty, makeRock, player, setGameState }) {
  world[fromY][fromX] = makeEmpty();
  world[toY][toX] = makeRock();
  moved[toY][toX] = true;

  if (player.x === toX && player.y === toY) {
    setGameState("lost", "You were crushed by a rock. Press R to retry.");
  }
}
