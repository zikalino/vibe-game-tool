import test from "node:test";
import assert from "node:assert/strict";

import { TileType } from "../tileDefs.js";
import { StoneObject } from "./stoneObject.js";

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
    drawImage(...args) {
      operations.push(["drawImage", ...args]);
    },
  };
}

test("stone draw uses image when a loaded image is provided", () => {
  const image = {
    complete: true,
    naturalWidth: 1,
    naturalHeight: 1,
  };
  const stoneObject = new StoneObject(TileType, image);
  const ctx = createMockContext();

  stoneObject.draw({ ctx, px: 0, py: 0, tileSize: 32 });

  assert.ok(ctx.operations.some((operation) => operation[0] === "drawImage"));
});

test("stone draw falls back to procedural pattern when image is not loaded", () => {
  const image = {
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0,
  };
  const stoneObject = new StoneObject(TileType, image);
  const ctx = createMockContext();

  stoneObject.draw({ ctx, px: 0, py: 0, tileSize: 32 });

  assert.ok(!ctx.operations.some((operation) => operation[0] === "drawImage"));
  assert.ok(ctx.operations.some((operation) => operation[0] === "fillRect"));
});
