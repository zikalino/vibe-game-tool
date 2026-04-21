export function clampTileCount(value) {
  return Math.max(1, Math.min(1000, value));
}

export function resizeWorldGrid(world, nextRows, nextCols, makeEmpty) {
  return resizeWorldGridWithOffset(world, nextRows, nextCols, 0, 0, makeEmpty);
}

export function resizeWorldGridWithOffset(world, nextRows, nextCols, offsetY, offsetX, makeEmpty) {
  const previousRows = world.length;
  const previousCols = previousRows > 0 ? world[0].length : 0;
  const resized = Array.from(
    { length: nextRows },
    () => Array.from({ length: nextCols }, () => makeEmpty()),
  );

  const availableRows = Math.max(0, nextRows - offsetY);
  const availableCols = Math.max(0, nextCols - offsetX);
  const rowsToCopy = Math.min(previousRows, availableRows);
  const colsToCopy = Math.min(previousCols, availableCols);

  for (let y = 0; y < rowsToCopy; y += 1) {
    for (let x = 0; x < colsToCopy; x += 1) {
      resized[y + offsetY][x + offsetX] = world[y][x];
    }
  }

  return resized;
}
