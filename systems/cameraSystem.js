function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculateCameraTarget({
  playerX,
  playerY,
  tileSize,
  viewportWidth,
  viewportHeight,
  scrollLeft,
  scrollTop,
  contentWidth,
  contentHeight,
  edgeMargin,
}) {
  const playerLeft = playerX * tileSize;
  const playerTop = playerY * tileSize;
  const playerRight = playerLeft + tileSize;
  const playerBottom = playerTop + tileSize;

  let targetLeft = scrollLeft;
  let targetTop = scrollTop;
  const rightBoundary = scrollLeft + viewportWidth - edgeMargin;
  const leftBoundary = scrollLeft + edgeMargin;
  const bottomBoundary = scrollTop + viewportHeight - edgeMargin;
  const topBoundary = scrollTop + edgeMargin;

  if (playerLeft < leftBoundary) {
    targetLeft = playerLeft - edgeMargin;
  } else if (playerRight > rightBoundary) {
    targetLeft = playerRight - (viewportWidth - edgeMargin);
  }

  if (playerTop < topBoundary) {
    targetTop = playerTop - edgeMargin;
  } else if (playerBottom > bottomBoundary) {
    targetTop = playerBottom - (viewportHeight - edgeMargin);
  }

  const maxScrollLeft = Math.max(0, contentWidth - viewportWidth);
  const maxScrollTop = Math.max(0, contentHeight - viewportHeight);

  return {
    targetLeft: clamp(targetLeft, 0, maxScrollLeft),
    targetTop: clamp(targetTop, 0, maxScrollTop),
  };
}

export function stepSmoothScroll(current, target, smoothing) {
  const next = current + (target - current) * smoothing;
  return Math.abs(target - next) < 0.5 ? target : next;
}
