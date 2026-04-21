import test from "node:test";
import assert from "node:assert/strict";

import { stepRocks } from "./rockSystem.js";
import { TileType, makeEmpty, makeRock, makeStone } from "../tiles/tileDefs.js";

function makeWorld(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => makeEmpty()));
}

test("rock falls into empty tile below", () => {
  const rows = 4;
  const cols = 4;
  const world = makeWorld(rows, cols);
  world[1][1] = makeRock();

  stepRocks({
    world,
    rows,
    cols,
    inBounds: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    tileType: TileType,
    makeEmpty,
    makeRock,
    player: { x: 0, y: 0 },
    setGameState: () => {},
    rollBias: 1,
  });

  assert.equal(world[2][1].type, TileType.ROCK);
});

test("charged rock moves horizontally and loses charge", () => {
  const rows = 4;
  const cols = 5;
  const world = makeWorld(rows, cols);
  world[1][2] = makeRock(2, 1);
  world[2][2] = makeStone();
  world[2][3] = makeStone();

  stepRocks({
    world,
    rows,
    cols,
    inBounds: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    tileType: TileType,
    makeEmpty,
    makeRock,
    player: { x: 0, y: 0 },
    setGameState: () => {},
    rollBias: 1,
  });

  assert.equal(world[1][3].type, TileType.ROCK);
  assert.equal(world[1][3].charge, 1);
  assert.equal(world[1][3].vx, 1);
});

test("charged rock drops charge when blocked", () => {
  const rows = 4;
  const cols = 5;
  const world = makeWorld(rows, cols);
  world[1][2] = makeRock(3, 1);
  world[1][3] = makeStone();
  world[1][1] = makeStone();
  world[2][2] = makeStone();
  world[2][1] = makeStone();
  world[2][3] = makeStone();

  stepRocks({
    world,
    rows,
    cols,
    inBounds: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    tileType: TileType,
    makeEmpty,
    makeRock,
    player: { x: 0, y: 0 },
    setGameState: () => {},
    rollBias: 1,
  });

  assert.equal(world[1][2].type, TileType.ROCK);
  assert.equal(world[1][2].charge, 0);
  assert.equal(world[1][2].vx, 0);
});
