import test from "node:test";
import assert from "node:assert/strict";

import {
  TileType,
  getTileObject,
  makeDiamond,
  makeEmpty,
  makeGoal,
  makeLava,
  makeMonsterHorizontal,
  makeMonsterVertical,
  makeMonsterWander,
  makeRock,
  makeSoil,
  makeStone,
  makeWater,
} from "../tiles/tileDefs.js";

function createMockContext() {
  const operations = [];
  return {
    operations,
    set fillStyle(value) {
      operations.push(["fillStyle", value]);
    },
    fillRect(...args) {
      operations.push(["fillRect", ...args]);
    },
    beginPath() {
      operations.push(["beginPath"]);
    },
    arc(...args) {
      operations.push(["arc", ...args]);
    },
    fill() {
      operations.push(["fill"]);
    },
    moveTo(...args) {
      operations.push(["moveTo", ...args]);
    },
    lineTo(...args) {
      operations.push(["lineTo", ...args]);
    },
    closePath() {
      operations.push(["closePath"]);
    },
  };
}

test("every tile object has draw implementation that renders without throwing", () => {
  const tileByType = {
    [TileType.EMPTY]: makeEmpty(),
    [TileType.STONE]: makeStone(),
    [TileType.SOIL]: makeSoil(),
    [TileType.WATER]: makeWater(0.5),
    [TileType.ROCK]: makeRock(),
    [TileType.DIAMOND]: makeDiamond(),
    [TileType.LAVA]: makeLava(),
    [TileType.MONSTER_H]: makeMonsterHorizontal(),
    [TileType.MONSTER_V]: makeMonsterVertical(),
    [TileType.MONSTER_WANDER]: makeMonsterWander(),
    [TileType.GOAL]: makeGoal(),
  };

  for (const [type, tile] of Object.entries(tileByType)) {
    const object = getTileObject(type);
    assert.equal(typeof object.draw, "function");
    const ctx = createMockContext();
    object.draw({ ctx, tile, px: 0, py: 0, tileSize: 32 });
    assert.ok(ctx.operations.length > 0);
  }
});
