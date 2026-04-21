export function hasActiveTransition(tile) {
  return typeof tile.transProgress === "number" && tile.transProgress > 0;
}

export function collectTransitioningTiles(world, emptyType) {
  const transitioningTiles = [];

  for (let y = 0; y < world.length; y += 1) {
    const row = world[y];
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile.type === emptyType || !hasActiveTransition(tile)) {
        continue;
      }
      transitioningTiles.push({ x, y, tile });
    }
  }

  return transitioningTiles;
}
