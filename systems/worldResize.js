export function clampTileCount(value, maxTiles = 1000) {
  return Math.max(1, Math.min(maxTiles, value));
}

export function resizeWorldGrid(world, nextRows, nextCols, makeEmpty) {
  const previousRows = world.length;
  const previousCols = previousRows > 0 ? world[0].length : 0;
  const resized = Array.from(
    { length: nextRows },
    () => Array.from({ length: nextCols }, () => makeEmpty()),
  );

  const rowsToCopy = Math.min(previousRows, nextRows);
  const colsToCopy = Math.min(previousCols, nextCols);

  for (let y = 0; y < rowsToCopy; y += 1) {
    for (let x = 0; x < colsToCopy; x += 1) {
      resized[y][x] = world[y][x];
    }
  }

  return resized;
}
