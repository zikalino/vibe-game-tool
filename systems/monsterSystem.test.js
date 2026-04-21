import test from "node:test";
import assert from "node:assert/strict";

import {
  TileType,
  makeEmpty,
  makeMonsterHorizontal,
  makeMonsterVertical,
  makeMonsterWander,
  makeStone,
  tickWorldObjects,
} from "../tiles/tileDefs.js";

function makeWorld(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => makeEmpty()));
}

test("horizontal monster reverses direction when blocked", () => {
  const rows = 5;
  const cols = 5;
  const world = makeWorld(rows, cols);
  world[2][2] = makeMonsterHorizontal(1);
  world[2][3] = makeStone();

  tickWorldObjects({
    world,
    rows,
    cols,
    inBounds: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    makeEmpty,
    makeRock: () => {},
    player: { x: 0, y: 0 },
    setGameState: () => {},
    rollBias: 1,
    shouldTickType: (type) => type === TileType.MONSTER_H,
  });

  assert.equal(world[2][1].type, TileType.MONSTER_H);
  assert.equal(world[2][1].dx, -1);
  assert.equal(world[2][1].transDx, 1);
  assert.equal(world[2][1].transDy, 0);
  assert.equal(world[2][1].transProgress, 1);
});

test("vertical monster reverses direction when blocked", () => {
  const rows = 5;
  const cols = 5;
  const world = makeWorld(rows, cols);
  world[2][2] = makeMonsterVertical(1);
  world[3][2] = makeStone();

  tickWorldObjects({
    world,
    rows,
    cols,
    inBounds: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    makeEmpty,
    makeRock: () => {},
    player: { x: 0, y: 0 },
    setGameState: () => {},
    rollBias: 1,
    shouldTickType: (type) => type === TileType.MONSTER_V,
  });

  assert.equal(world[1][2].type, TileType.MONSTER_V);
  assert.equal(world[1][2].dy, -1);
});

test("wander monster can kill player on contact", () => {
  const rows = 5;
  const cols = 5;
  const world = makeWorld(rows, cols);
  world[2][2] = makeMonsterWander(1, 0);
  const player = { x: 3, y: 2 };

  let state = "playing";
  tickWorldObjects({
    world,
    rows,
    cols,
    inBounds: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    makeEmpty,
    makeRock: () => {},
    player,
    setGameState: (nextState) => {
      state = nextState;
    },
    random: () => 0,
    rollBias: 1,
    shouldTickType: (type) => type === TileType.MONSTER_WANDER,
  });

  assert.equal(state, "lost");
});
