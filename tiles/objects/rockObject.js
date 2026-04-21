import { BaseObject } from "../baseObject.js";

export class RockObject extends BaseObject {
  constructor(tileType) {
    super(tileType.ROCK);
    this.tileType = tileType;
  }

  create(charge = 0, vx = 0) {
    return super.create({ charge: Math.max(0, charge), vx });
  }

  tick({ x, y, world, inBounds, moved, makeEmpty, makeRock, player, setGameState, rollDirs }) {
    const { tileType } = this;
    if (moved[y][x] || world[y][x].type !== tileType.ROCK) {
      return;
    }

    const rock = world[y][x];
    if (rock.charge > 0 && rock.vx !== 0) {
      const nx = x + rock.vx;
      if (inBounds(nx, y) && world[y][nx].type === tileType.EMPTY) {
        moveRock({
          fromX: x,
          fromY: y,
          toX: nx,
          toY: y,
          moved,
          world,
          makeEmpty,
          makeRock,
          player,
          setGameState,
          charge: rock.charge - 1,
          vx: rock.vx,
        });
        return;
      }

      world[y][x] = makeRock(0, 0);
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
        charge: world[y][x].charge,
        vx: world[y][x].vx,
      });
      return;
    }

    if (!isRockSupport(below, tileType)) {
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
        charge: world[y][x].charge,
        vx: world[y][x].vx,
      });
      return;
    }
  }
}

function isRockSupport(tile, tileType) {
  return tile.type === tileType.STONE || tile.type === tileType.ROCK;
}

function moveRock({ fromX, fromY, toX, toY, moved, world, makeEmpty, makeRock, player, setGameState, charge = 0, vx = 0 }) {
  world[fromY][fromX] = makeEmpty();
  world[toY][toX] = makeRock(charge, vx);
  moved[toY][toX] = true;

  if (player.x === toX && player.y === toY) {
    setGameState("lost", "You were crushed by a rock. Press R to retry.");
  }
}
