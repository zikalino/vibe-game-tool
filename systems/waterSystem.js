export function stepWater({
  world,
  rows,
  cols,
  tileType,
  makeEmpty,
  makeWater,
  canHoldWater,
  getWaterAmount,
  config,
}) {
  const mass = buildWaterMass({ world, rows, cols, canHoldWater, getWaterAmount });

  for (let i = 0; i < config.passes; i += 1) {
    relaxWaterMass({ mass, world, rows, cols, canHoldWater, config });
  }

  writeWaterMass({ mass, world, rows, cols, canHoldWater, makeEmpty, makeWater, config, tileType });
}

function buildWaterMass({ world, rows, cols, canHoldWater, getWaterAmount }) {
  const mass = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!canHoldWater(world[y][x])) {
        continue;
      }

      mass[y][x] = getWaterAmount(world[y][x]);
    }
  }

  return mass;
}

function relaxWaterMass({ mass, world, rows, cols, canHoldWater, config }) {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!canHoldWater(world[y][x])) {
        continue;
      }

      let remaining = mass[y][x];
      if (remaining <= 0) {
        continue;
      }

      if (y + 1 < rows && canHoldWater(world[y + 1][x])) {
        let flow = getStableMass(remaining + mass[y + 1][x], config) - mass[y + 1][x];
        if (flow > config.min) {
          flow *= config.flow;
        }

        flow = clamp(flow, 0, Math.min(config.maxFlow, remaining));
        if (flow > 0) {
          mass[y][x] -= flow;
          mass[y + 1][x] += flow;
          remaining -= flow;
        }
      }

      if (remaining <= 0) {
        continue;
      }

      if (x - 1 >= 0 && canHoldWater(world[y][x - 1])) {
        let flow = (mass[y][x] - mass[y][x - 1]) * 0.25;
        if (flow > config.min) {
          flow *= config.flow;
        }

        flow = clamp(flow, 0, Math.min(config.maxFlow, mass[y][x]));
        if (flow > 0) {
          mass[y][x] -= flow;
          mass[y][x - 1] += flow;
        }
      }

      if (x + 1 < cols && canHoldWater(world[y][x + 1])) {
        let flow = (mass[y][x] - mass[y][x + 1]) * 0.25;
        if (flow > config.min) {
          flow *= config.flow;
        }

        flow = clamp(flow, 0, Math.min(config.maxFlow, mass[y][x]));
        if (flow > 0) {
          mass[y][x] -= flow;
          mass[y][x + 1] += flow;
        }
      }

      if (y - 1 >= 0 && canHoldWater(world[y - 1][x])) {
        let flow = mass[y][x] - getStableMass(mass[y][x] + mass[y - 1][x], config);
        if (flow > config.min) {
          flow *= config.flow;
        }

        flow = clamp(flow, 0, Math.min(config.maxFlow, mass[y][x]));
        if (flow > 0) {
          mass[y][x] -= flow;
          mass[y - 1][x] += flow;
        }
      }
    }
  }
}

function getStableMass(totalMass, config) {
  if (totalMass <= config.max) {
    return config.max;
  }

  if (totalMass < 2 * config.max + config.compress) {
    return (config.max + totalMass * config.compress) / (config.max + config.compress);
  }

  return (totalMass + config.compress) / 2;
}

function writeWaterMass({ mass, world, rows, cols, canHoldWater, makeEmpty, makeWater, config, tileType }) {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!canHoldWater(world[y][x])) {
        continue;
      }

      const amount = mass[y][x];
      if (amount < config.min) {
        if (world[y][x].type === tileType.WATER) {
          world[y][x] = makeEmpty();
        }
      } else {
        const clamped = clamp(amount, 0, config.max + config.compress * rows);
        world[y][x] = makeWater(clamped);
      }
    }
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
