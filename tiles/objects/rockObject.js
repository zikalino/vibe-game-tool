import { BaseObject } from "../baseObject.js";

export class RockObject extends BaseObject {
  constructor(tileType) {
    super(tileType.ROCK);
    this.tileType = tileType;
  }

  create(charge = 0, vx = 0) {
    return super.create({ charge: Math.max(0, charge), vx });
  }

  draw({ ctx, px, py, tileSize }) {
    ctx.fillStyle = "#4f4f4f";
    ctx.beginPath();
    ctx.arc(px + tileSize / 2, py + tileSize / 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#808080";
    ctx.beginPath();
    ctx.arc(px + tileSize / 2 - 4, py + tileSize / 2 - 4, 7, 0, Math.PI * 2);
    ctx.fill();
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
  const nextRock = makeRock(charge, vx);
  nextRock.transDx = fromX - toX;
  nextRock.transDy = fromY - toY;
  nextRock.transProgress = 1;
  world[toY][toX] = nextRock;
  moved[toY][toX] = true;

  if (player.x === toX && player.y === toY) {
    setGameState("lost", "You were crushed by a rock. Press R to retry.");
  }
}
