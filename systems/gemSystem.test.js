import test from "node:test";
import assert from "node:assert/strict";

import { TileType, makeDiamond, makeEmpty, makeStone, tickWorldObjects } from "../tiles/tileDefs.js";

function makeWorld(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => makeEmpty()));
}

test("gem falls one tile when space below is empty", () => {
  const rows = 5;
  const cols = 4;
  const world = makeWorld(rows, cols);
  world[1][1] = makeDiamond();

  tickWorldObjects({
    world,
    rows,
    cols,
    inBounds: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    makeEmpty,
    makeDiamond,
    player: { x: 0, y: 0 },
    setGameState: () => {},
    rollBias: 1,
    shouldTickType: (type) => type === TileType.DIAMOND,
  });

  assert.equal(world[2][1].type, TileType.DIAMOND);
  assert.equal(world[2][1].fallDistance, 1);
});

test("gem shatters after high fall onto stone", () => {
  const rows = 6;
  const cols = 4;
  const world = makeWorld(rows, cols);
  world[3][1] = makeDiamond(3);
  world[4][1] = makeStone();

  tickWorldObjects({
    world,
    rows,
    cols,
    inBounds: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    makeEmpty,
    makeDiamond,
    player: { x: 0, y: 0 },
    setGameState: () => {},
    rollBias: 1,
    shouldTickType: (type) => type === TileType.DIAMOND,
  });

  assert.equal(world[3][1].type, TileType.EMPTY);
});
