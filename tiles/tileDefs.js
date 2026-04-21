import { BaseObject } from "./baseObject.js";
import { MonsterHorizontalObject } from "./objects/monsterHorizontalObject.js";
import { MonsterVerticalObject } from "./objects/monsterVerticalObject.js";
import { MonsterWanderObject } from "./objects/monsterWanderObject.js";
import { GemObject } from "./objects/gemObject.js";
import { LavaObject } from "./objects/lavaObject.js";
import { RockObject } from "./objects/rockObject.js";
import { WaterObject } from "./objects/waterObject.js";

export const TileType = {
  EMPTY: "empty",
  STONE: "stone",
  SOIL: "soil",
  WATER: "water",
  ROCK: "rock",
  DIAMOND: "diamond",
  LAVA: "lava",
  MONSTER_H: "monster_h",
  MONSTER_V: "monster_v",
  MONSTER_WANDER: "monster_wander",
  GOAL: "goal",
};

const objectDefinitions = {
  [TileType.EMPTY]: new BaseObject(TileType.EMPTY),
  [TileType.STONE]: new BaseObject(TileType.STONE),
  [TileType.SOIL]: new BaseObject(TileType.SOIL),
  [TileType.WATER]: new WaterObject(TileType.WATER),
  [TileType.ROCK]: new RockObject(TileType),
  [TileType.DIAMOND]: new GemObject(TileType),
  [TileType.LAVA]: new LavaObject(TileType),
  [TileType.MONSTER_H]: new MonsterHorizontalObject(TileType),
  [TileType.MONSTER_V]: new MonsterVerticalObject(TileType),
  [TileType.MONSTER_WANDER]: new MonsterWanderObject(TileType),
  [TileType.GOAL]: new BaseObject(TileType.GOAL),
};

export function isMonsterType(type) {
  return type === TileType.MONSTER_H || type === TileType.MONSTER_V || type === TileType.MONSTER_WANDER;
}

export function makeEmpty() {
  return objectDefinitions[TileType.EMPTY].create();
}

export function makeStone() {
  return objectDefinitions[TileType.STONE].create();
}

export function makeSoil() {
  return objectDefinitions[TileType.SOIL].create();
}

export function makeWater(amount) {
  return objectDefinitions[TileType.WATER].create(amount);
}

export function makeRock(charge = 0, vx = 0) {
  return objectDefinitions[TileType.ROCK].create(charge, vx);
}

export function makeDiamond(fallDistance = 0) {
  return objectDefinitions[TileType.DIAMOND].create(fallDistance);
}

export function makeLava() {
  return objectDefinitions[TileType.LAVA].create();
}

export function makeMonsterHorizontal(dir = 1) {
  return objectDefinitions[TileType.MONSTER_H].create(dir);
}

export function makeMonsterVertical(dir = 1) {
  return objectDefinitions[TileType.MONSTER_V].create(dir);
}

export function makeMonsterWander(dx = 1, dy = 0) {
  return objectDefinitions[TileType.MONSTER_WANDER].create(dx, dy);
}

export function makeGoal() {
  return objectDefinitions[TileType.GOAL].create();
}

export function canHoldWater(tile) {
  return tile.type === TileType.EMPTY || tile.type === TileType.WATER;
}

export function getWaterAmount(tile) {
  return tile.type === TileType.WATER ? tile.water : 0;
}

export function tickWorldObjects({
  world,
  rows,
  cols,
  inBounds,
  makeEmpty,
  makeRock,
  makeDiamond,
  makeLava,
  player,
  setGameState,
  random,
  rollBias,
  shouldTickType,
}) {
  const rand = typeof random === "function" ? random : Math.random;
  let nextRollBias = rollBias;

  const typeOrder = [TileType.ROCK, TileType.DIAMOND, TileType.LAVA, TileType.MONSTER_H, TileType.MONSTER_V, TileType.MONSTER_WANDER];

  for (const type of typeOrder) {
    if (typeof shouldTickType === "function" && !shouldTickType(type)) {
      continue;
    }

    const object = objectDefinitions[type];
    if (!object || typeof object.tick !== "function") {
      continue;
    }

    const moved = Array.from({ length: rows }, () => new Array(cols).fill(false));
    const isFallingObject = type === TileType.ROCK || type === TileType.DIAMOND;
    const yStart = isFallingObject ? rows - 2 : 0;
    const yEnd = isFallingObject ? -1 : rows;
    const yStep = isFallingObject ? -1 : 1;
    const rollDirs = rollBias > 0 ? [1, -1] : [-1, 1];

    for (let y = yStart; y !== yEnd; y += yStep) {
      for (let x = 0; x < cols; x += 1) {
        if (world[y][x].type !== type) {
          continue;
        }

        object.tick({
          x,
          y,
          world,
          inBounds,
          moved,
          makeEmpty,
          makeRock,
          makeDiamond,
          makeLava,
          player,
          setGameState,
          random: rand,
          rollDirs,
        });
      }
    }

    if (type === TileType.ROCK) {
      nextRollBias = -rollBias;
    }
  }

  return nextRollBias;
}
