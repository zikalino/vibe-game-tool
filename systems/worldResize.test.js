import test from "node:test";
import assert from "node:assert/strict";

import { makeEmpty, makeStone, TileType } from "../tiles/tileDefs.js";
import { clampTileCount, resizeWorldGrid } from "./worldResize.js";

test("resizeWorldGrid keeps overlapping tiles and fills new space with empty tiles", () => {
  const world = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => makeEmpty()));
  world[0][0] = makeStone();

  const resized = resizeWorldGrid(world, 3, 4, makeEmpty);

  assert.equal(resized.length, 3);
  assert.equal(resized[0].length, 4);
  assert.equal(resized[0][0].type, TileType.STONE);
  assert.equal(resized[2][3].type, TileType.EMPTY);
});

test("resizeWorldGrid can build a 1000x1000 tile map", () => {
  const world = [[makeStone()]];

  const resized = resizeWorldGrid(world, 1000, 1000, makeEmpty);

  assert.equal(resized.length, 1000);
  assert.equal(resized[0].length, 1000);
  assert.equal(resized[0][0].type, TileType.STONE);
  assert.equal(resized[999][999].type, TileType.EMPTY);
});

test("clampTileCount clamps values between 1 and 1000", () => {
  assert.equal(clampTileCount(0), 1);
  assert.equal(clampTileCount(42), 42);
  assert.equal(clampTileCount(2000), 1000);
});
