import test from "node:test";
import assert from "node:assert/strict";

import { collectTransitioningTiles, hasActiveTransition } from "./transitionRenderSystem.js";

test("hasActiveTransition returns true only for positive transition progress", () => {
  assert.equal(hasActiveTransition({ type: "rock", transProgress: 1 }), true);
  assert.equal(hasActiveTransition({ type: "rock", transProgress: 0.4 }), true);
  assert.equal(hasActiveTransition({ type: "rock", transProgress: 0 }), false);
  assert.equal(hasActiveTransition({ type: "rock", transProgress: -1 }), false);
  assert.equal(hasActiveTransition({ type: "rock" }), false);
});

test("collectTransitioningTiles excludes empty and finished tiles", () => {
  const world = [
    [
      { type: "rock", transProgress: 0.5 },
      { type: "empty", transProgress: 0.7 },
      { type: "diamond", transProgress: 0 },
    ],
    [
      { type: "monster_wander", transProgress: 0.2 },
      { type: "soil" },
      { type: "rock", transProgress: -0.1 },
    ],
  ];

  const result = collectTransitioningTiles(world, "empty");

  assert.deepEqual(result, [
    { x: 0, y: 0, tile: world[0][0] },
    { x: 0, y: 1, tile: world[1][0] },
  ]);
});
