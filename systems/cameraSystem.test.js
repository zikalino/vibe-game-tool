import test from "node:test";
import assert from "node:assert/strict";

import { calculateCameraTarget, stepSmoothScroll } from "./cameraSystem.js";

test("calculateCameraTarget keeps camera when player is inside safe viewport", () => {
  const result = calculateCameraTarget({
    playerX: 5,
    playerY: 5,
    tileSize: 32,
    viewportWidth: 320,
    viewportHeight: 240,
    scrollLeft: 64,
    scrollTop: 64,
    contentWidth: 1024,
    contentHeight: 768,
    edgeMargin: 96,
  });

  assert.deepEqual(result, { targetLeft: 64, targetTop: 64 });
});

test("calculateCameraTarget moves camera when player approaches edge", () => {
  const result = calculateCameraTarget({
    playerX: 12,
    playerY: 10,
    tileSize: 32,
    viewportWidth: 320,
    viewportHeight: 240,
    scrollLeft: 64,
    scrollTop: 64,
    contentWidth: 1024,
    contentHeight: 768,
    edgeMargin: 96,
  });

  assert.equal(result.targetLeft > 64, true);
  assert.equal(result.targetTop > 64, true);
});

test("stepSmoothScroll interpolates and snaps near target", () => {
  assert.equal(stepSmoothScroll(0, 100, 0.2), 20);
  assert.equal(stepSmoothScroll(99.7, 100, 0.2), 100);
});
