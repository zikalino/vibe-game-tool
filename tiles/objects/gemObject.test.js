import test from "node:test";
import assert from "node:assert/strict";

import { TileType } from "../tileDefs.js";
import { GemObject } from "./gemObject.js";

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
    moveTo(...args) {
      operations.push(["moveTo", ...args]);
    },
    lineTo(...args) {
      operations.push(["lineTo", ...args]);
    },
    closePath() {
      operations.push(["closePath"]);
    },
    fill() {
      operations.push(["fill"]);
    },
    drawImage(...args) {
      operations.push(["drawImage", ...args]);
    },
  };
}

test("gem draw uses image when a loaded image is provided", () => {
  const image = {
    complete: true,
    naturalWidth: 1,
    naturalHeight: 1,
  };
  const gemObject = new GemObject(TileType, image);
  const ctx = createMockContext();

  gemObject.draw({ ctx, px: 0, py: 0, tileSize: 32 });

  assert.ok(ctx.operations.some((operation) => operation[0] === "drawImage"));
});

test("gem draw falls back to procedural diamond when image is not loaded", () => {
  const image = {
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0,
  };
  const gemObject = new GemObject(TileType, image);
  const ctx = createMockContext();

  gemObject.draw({ ctx, px: 0, py: 0, tileSize: 32 });

  assert.ok(!ctx.operations.some((operation) => operation[0] === "drawImage"));
  assert.ok(ctx.operations.some((operation) => operation[0] === "moveTo"));
});
