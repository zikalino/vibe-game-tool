import test from "node:test";
import assert from "node:assert/strict";

import { TileType, makeEmpty, makeLava, tickWorldObjects } from "../tiles/tileDefs.js";

function makeWorld(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => makeEmpty()));
}

test("lava slowly expands into an adjacent empty tile", () => {
  const rows = 4;
  const cols = 4;
  const world = makeWorld(rows, cols);
  world[1][1] = makeLava();
  const sequence = [0, 0];

  tickWorldObjects({
    world,
    rows,
    cols,
    inBounds: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    makeEmpty,
    makeLava,
    player: { x: 3, y: 3 },
    setGameState: () => {},
    random: () => sequence.shift() ?? 0,
    rollBias: 1,
    shouldTickType: (type) => type === TileType.LAVA,
  });

  const lavaTiles = world.flat().filter((tile) => tile.type === TileType.LAVA).length;
  assert.equal(lavaTiles, 2);
});

test("lava does not expand when expansion chance does not trigger", () => {
  const rows = 4;
  const cols = 4;
  const world = makeWorld(rows, cols);
  world[1][1] = makeLava();

  tickWorldObjects({
    world,
    rows,
    cols,
    inBounds: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    makeEmpty,
    makeLava,
    player: { x: 3, y: 3 },
    setGameState: () => {},
    random: () => 1,
    rollBias: 1,
    shouldTickType: (type) => type === TileType.LAVA,
  });

  const lavaTiles = world.flat().filter((tile) => tile.type === TileType.LAVA).length;
  assert.equal(lavaTiles, 1);
});
