import {
  TileType,
  canHoldWater,
  getWaterAmount,
  isMonsterType,
  makeDiamond,
  makeEmpty,
  makeGoal,
  makeLava,
  makeMonsterHorizontal,
  makeMonsterVertical,
  makeMonsterWander,
  makeRock,
  makeSoil,
  makeStone,
  tickWorldObjects,
  makeWater,
} from "./tiles/tileDefs.js";
import { stepWater } from "./systems/waterSystem.js";
import { clampTileCount, resizeWorldGridWithOffset } from "./systems/worldResize.js";
import { calculateCameraTarget, stepSmoothScroll } from "./systems/cameraSystem.js";

const TILE_SIZE = 32;
let COLS = 24;
let ROWS = 16;
const WATER_MIN = 0.002;
const WATER_MAX = 1;
const WATER_COMPRESS = 0.08;
const WATER_FLOW = 1;
const WATER_MAX_FLOW = 0.5;
const WATER_PASSES = 10;
const DIAMOND_GOAL = 4;
const MAX_ROCK_CHARGE = 8;
const DROWN_THRESHOLD = 0.65;
const DROWN_LIMIT = 120;
const ROCK_STEP_FRAMES = 4;
const MONSTER_STEP_FRAMES = 6;
const CAMERA_EDGE_MARGIN_TILES = 3;
const CAMERA_SMOOTHING = 0.2;
const MOVE_KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
const ACTION_KEYS = ["f", " "];

const waterConfig = {
  min: WATER_MIN,
  max: WATER_MAX,
  compress: WATER_COMPRESS,
  flow: WATER_FLOW,
  maxFlow: WATER_MAX_FLOW,
  passes: WATER_PASSES,
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const diamondCountEl = document.getElementById("diamondCount");
const gameStateEl = document.getElementById("gameState");
const toolsEl = document.getElementById("tools");
const winOverlayEl = document.getElementById("winOverlay");
const playAgainBtn = document.getElementById("playAgainBtn");
const playBtn = document.getElementById("playBtn");
const editBtn = document.getElementById("editBtn");
const exitPlayBtn = document.getElementById("exitPlayBtn");
const edgeControlsEl = document.getElementById("edgeControls");
const mapResizeEl = document.querySelector(".map-resize");
const gameWrapEl = document.querySelector(".game-wrap");

const world = buildWorld();
const player = {
  x: 2,
  y: 2,
  facing: { x: 1, y: 0 },
};
const spawnPoint = { x: player.x, y: player.y };

let brokenSoil = 0;
let collectedDiamonds = 0;
let selectedTool = "stone";
let gameState = "playing";
let drownTicks = 0;
let isMousePouring = false;
let rockRollBias = 1;
let rockFrameCounter = 0;
let monsterFrameCounter = 0;
let appMode = "edit";
let savedWorld = null;
let cameraScrollLeft = 0;
let cameraScrollTop = 0;

window.addEventListener("keydown", onKeyDown);
canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mousemove", onMouseMove);
window.addEventListener("mouseup", onMouseUp);
canvas.addEventListener("mouseleave", onMouseLeave);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
toolsEl.addEventListener("click", onToolClick);
playAgainBtn.addEventListener("click", resetGame);
playBtn.addEventListener("click", startPlay);
editBtn.addEventListener("click", startEdit);
exitPlayBtn.addEventListener("click", startEdit);
edgeControlsEl.addEventListener("click", onExpandEdgeClick);
new ResizeObserver(onMapResize).observe(mapResizeEl);
edgeControlsEl.style.width = `${canvas.width}px`;
edgeControlsEl.style.height = `${canvas.height}px`;

updateHud();
requestAnimationFrame(loop);

function loop() {
  if (appMode === "play" && gameState === "playing") {
    rockFrameCounter += 1;
    monsterFrameCounter += 1;

    const shouldTickRocks = rockFrameCounter >= ROCK_STEP_FRAMES;
    const shouldTickMonsters = monsterFrameCounter >= MONSTER_STEP_FRAMES;

    if (shouldTickRocks || shouldTickMonsters) {
      rockRollBias = tickWorldObjects({
        world,
        rows: ROWS,
        cols: COLS,
        inBounds,
        makeEmpty,
        makeRock,
        player,
        setGameState,
        rollBias: rockRollBias,
        shouldTickType: (type) => (type === TileType.ROCK && shouldTickRocks) || (isMonsterType(type) && shouldTickMonsters),
      });
    }

    if (shouldTickRocks) {
      rockFrameCounter = 0;
    }

    if (shouldTickMonsters) {
      monsterFrameCounter = 0;
    }

    for (let i = 0; i < 4; i += 1) {
      stepWater({
        world,
        rows: ROWS,
        cols: COLS,
        tileType: TileType,
        makeEmpty,
        makeWater,
        canHoldWater,
        getWaterAmount,
        config: waterConfig,
      });
    }

    updatePlayerState();
  }

  if (appMode === "play") {
    updateCamera();
  }

  updateHud();
  draw();
  requestAnimationFrame(loop);
}

function setGameState(nextState, reason) {
  if (gameState !== "playing") {
    return;
  }

  gameState = nextState;
  gameStateEl.textContent = reason;

  if (nextState === "won") {
    winOverlayEl.classList.remove("hidden");
  }
}

function updatePlayerState() {
  const standing = world[player.y][player.x];

  if (standing.type === TileType.GOAL && collectedDiamonds >= DIAMOND_GOAL) {
    setGameState("won", "You won. Goal reached.");
    return;
  }

  if (standing.type === TileType.LAVA) {
    setGameState("lost", "You burned in lava. Press R to retry.");
    return;
  }

  const waterHere = standing.type === TileType.WATER ? standing.water : 0;
  if (waterHere >= DROWN_THRESHOLD) {
    drownTicks += 1;
  } else {
    drownTicks = Math.max(0, drownTicks - 2);
  }

  if (drownTicks >= DROWN_LIMIT) {
    setGameState("lost", "You drowned. Press R to retry.");
  }
}

function onToolClick(event) {
  const button = event.target.closest("button[data-tool]");
  if (!button) {
    return;
  }

  setSelectedTool(button.dataset.tool);
}

function setSelectedTool(tool) {
  selectedTool = tool;
  const toolButtons = toolsEl.querySelectorAll("button[data-tool]");
  for (const button of toolButtons) {
    button.classList.toggle("is-active", button.dataset.tool === tool);
  }
}

function onMouseDown(event) {
  if (appMode === "play") {
    return;
  }

  const point = getMouseTile(event);
  if (!point) {
    return;
  }

  const { x, y } = point;
  if ((x === player.x && y === player.y) || world[y][x].type === TileType.GOAL) {
    return;
  }

  if (event.button === 2 || selectedTool === "erase") {
    world[y][x] = makeEmpty();
    return;
  }

  if (selectedTool === "water" && event.button === 0) {
    isMousePouring = true;
    pourWaterAt(x, y, WATER_MAX);
    return;
  }

  if (selectedTool === "stone") {
    world[y][x] = makeStone();
  } else if (selectedTool === "soil") {
    world[y][x] = makeSoil();
  } else if (selectedTool === "rock") {
    world[y][x] = makeRock();
  } else if (selectedTool === "diamond") {
    world[y][x] = makeDiamond();
  } else if (selectedTool === "lava") {
    world[y][x] = makeLava();
  } else if (selectedTool === "monsterH") {
    world[y][x] = makeMonsterHorizontal();
  } else if (selectedTool === "monsterV") {
    world[y][x] = makeMonsterVertical();
  } else if (selectedTool === "monsterWander") {
    world[y][x] = makeMonsterWander();
  }
}

function onMouseMove(event) {
  if (appMode === "play") {
    return;
  }

  if (!isMousePouring) {
    return;
  }

  const point = getMouseTile(event);
  if (!point) {
    return;
  }

  pourWaterAt(point.x, point.y, 0.35);
}

function onMouseUp() {
  isMousePouring = false;
}

function onMouseLeave() {
  isMousePouring = false;
}

function getMouseTile(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor(((event.clientX - rect.left) * scaleX) / TILE_SIZE);
  const y = Math.floor(((event.clientY - rect.top) * scaleY) / TILE_SIZE);

  if (!inBounds(x, y)) {
    return null;
  }

  return { x, y };
}

function onMapResize(entries) {
  const entry = entries[0];
  if (!entry) {
    return;
  }

  const nextCols = clampTileCount(Math.round(entry.contentRect.width / TILE_SIZE));
  const nextRows = clampTileCount(Math.round(entry.contentRect.height / TILE_SIZE));
  resizeMap(nextCols, nextRows);
}

function resizeMap(nextCols, nextRows) {
  resizeMapWithOffset(nextCols, nextRows, 0, 0);
}

function resizeMapWithOffset(nextCols, nextRows, offsetX, offsetY) {
  if (nextCols === COLS && nextRows === ROWS) {
    return;
  }

  const resizedWorld = resizeWorldGridWithOffset(world, nextRows, nextCols, offsetY, offsetX, makeEmpty);
  world.length = 0;
  for (const row of resizedWorld) {
    world.push(row);
  }

  if (savedWorld !== null) {
    savedWorld = resizeWorldGridWithOffset(savedWorld, nextRows, nextCols, offsetY, offsetX, makeEmpty);
  }

  COLS = nextCols;
  ROWS = nextRows;
  canvas.width = COLS * TILE_SIZE;
  canvas.height = ROWS * TILE_SIZE;
  mapResizeEl.style.width = `${canvas.width}px`;
  mapResizeEl.style.height = `${canvas.height}px`;
  edgeControlsEl.style.width = `${canvas.width}px`;
  edgeControlsEl.style.height = `${canvas.height}px`;
  player.x = Math.min(player.x + offsetX, COLS - 1);
  player.y = Math.min(player.y + offsetY, ROWS - 1);
  spawnPoint.x = Math.min(spawnPoint.x + offsetX, COLS - 1);
  spawnPoint.y = Math.min(spawnPoint.y + offsetY, ROWS - 1);
}

function onExpandEdgeClick(event) {
  if (appMode !== "edit") {
    return;
  }

  const button = event.target.closest("button[data-expand-edge][data-expand-amount]");
  if (!button) {
    return;
  }

  const edge = button.dataset.expandEdge;
  const amount = Number(button.dataset.expandAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const addLeft = edge === "left" ? amount : 0;
  const addRight = edge === "right" ? amount : 0;
  const addTop = edge === "top" ? amount : 0;
  const addBottom = edge === "bottom" ? amount : 0;
  const nextCols = clampTileCount(COLS + addLeft + addRight);
  const nextRows = clampTileCount(ROWS + addTop + addBottom);
  if (nextCols === COLS && nextRows === ROWS) {
    return;
  }
  const extraCols = nextCols - COLS;
  const extraRows = nextRows - ROWS;
  const offsetX = Math.min(addLeft, extraCols);
  const offsetY = Math.min(addTop, extraRows);
  resizeMapWithOffset(nextCols, nextRows, offsetX, offsetY);
}

function pourWaterAt(x, y, amount) {
  if (!inBounds(x, y)) {
    return;
  }

  const tile = world[y][x];
  if (tile.type === TileType.EMPTY) {
    world[y][x] = makeWater(Math.min(amount, WATER_MAX));
    return;
  }

  if (tile.type === TileType.WATER) {
    tile.water = Math.min(tile.water + amount, WATER_MAX + WATER_COMPRESS * ROWS);
  }
}

function resetGame() {
  if (appMode === "play" && savedWorld !== null) {
    copyInto(world, savedWorld);
  } else {
    const fresh = buildWorld();
    copyInto(world, fresh);
  }
  player.x = spawnPoint.x;
  player.y = spawnPoint.y;
  player.facing = { x: 1, y: 0 };
  brokenSoil = 0;
  collectedDiamonds = 0;
  drownTicks = 0;
  gameState = "playing";
  rockFrameCounter = 0;
  rockRollBias = 1;
  monsterFrameCounter = 0;
  isMousePouring = false;
  winOverlayEl.classList.add("hidden");
}

function startPlay() {
  savedWorld = cloneWorld(world);
  player.x = spawnPoint.x;
  player.y = spawnPoint.y;
  player.facing = { x: 1, y: 0 };
  brokenSoil = 0;
  collectedDiamonds = 0;
  drownTicks = 0;
  gameState = "playing";
  rockFrameCounter = 0;
  rockRollBias = 1;
  monsterFrameCounter = 0;
  isMousePouring = false;
  winOverlayEl.classList.add("hidden");
  appMode = "play";
  document.body.classList.add("play-mode");
  cameraScrollLeft = gameWrapEl.scrollLeft;
  cameraScrollTop = gameWrapEl.scrollTop;
  playBtn.classList.add("hidden");
  editBtn.classList.remove("hidden");
  exitPlayBtn.classList.remove("hidden");
  edgeControlsEl.classList.add("hidden");
  updateHud();
}

function startEdit() {
  if (savedWorld !== null) {
    copyInto(world, savedWorld);
    savedWorld = null;
  }
  player.x = spawnPoint.x;
  player.y = spawnPoint.y;
  player.facing = { x: 1, y: 0 };
  brokenSoil = 0;
  collectedDiamonds = 0;
  drownTicks = 0;
  gameState = "playing";
  monsterFrameCounter = 0;
  isMousePouring = false;
  winOverlayEl.classList.add("hidden");
  appMode = "edit";
  document.body.classList.remove("play-mode");
  gameWrapEl.scrollLeft = 0;
  gameWrapEl.scrollTop = 0;
  cameraScrollLeft = 0;
  cameraScrollTop = 0;
  playBtn.classList.remove("hidden");
  editBtn.classList.add("hidden");
  exitPlayBtn.classList.add("hidden");
  edgeControlsEl.classList.remove("hidden");
  updateHud();
}

function cloneWorld(src) {
  return src.map((row) => row.map((tile) => ({ ...tile })));
}

function updateHud() {
  diamondCountEl.textContent = `${collectedDiamonds} / ${DIAMOND_GOAL}`;

  if (appMode === "edit") {
    gameStateEl.textContent = "Editing";
  } else if (gameState === "playing") {
    if (collectedDiamonds >= DIAMOND_GOAL) {
      gameStateEl.textContent = "Goal unlocked. Reach the yellow tile.";
    } else {
      gameStateEl.textContent = "Playing";
    }
  }
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  const isMoveKey = MOVE_KEYS.includes(key);
  const isActionKey = ACTION_KEYS.includes(key);

  if (appMode === "play" && (isMoveKey || isActionKey)) {
    event.preventDefault();
  }

  if (key === "r") {
    resetGame();
    return;
  }

  if (key === "1" || key === "2" || key === "3" || key === "4" || key === "5" || key === "6" || key === "7" || key === "8" || key === "9" || key === "0") {
    const map = {
      "1": "stone",
      "2": "soil",
      "3": "water",
      "4": "rock",
      "5": "monsterH",
      "6": "monsterV",
      "7": "monsterWander",
      "8": "diamond",
      "9": "lava",
      "0": "erase",
    };
    setSelectedTool(map[key]);
    return;
  }

  if (appMode !== "play" || gameState !== "playing") {
    return;
  }

  if (key === "f") {
    pourWaterForward();
    return;
  }

  if (key === "arrowup" || key === "w") {
    tryMove(0, -1);
  } else if (key === "arrowdown" || key === "s") {
    tryMove(0, 1);
  } else if (key === "arrowleft" || key === "a") {
    tryMove(-1, 0);
  } else if (key === "arrowright" || key === "d") {
    tryMove(1, 0);
  } else if (key === " ") {
    breakSoil();
  }
}

function tryMove(dx, dy) {
  if (dx !== 0 || dy !== 0) {
    player.facing.x = dx;
    player.facing.y = dy;
  }

  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!inBounds(nx, ny)) {
    return;
  }

  const target = world[ny][nx];
  if (
    target.type === TileType.MONSTER_H
    || target.type === TileType.MONSTER_V
    || target.type === TileType.MONSTER_WANDER
  ) {
    setGameState("lost", "A monster got you. Press R to retry.");
    return;
  }
  if (target.type === TileType.ROCK && dy === 0) {
    if (!hasRockSupport(nx, ny)) {
      return;
    }
    const pushX = nx + dx;
    if (!inBounds(pushX, ny) || world[ny][pushX].type !== TileType.EMPTY) {
      return;
    }
    const nextCharge = Math.min(target.charge + 1, MAX_ROCK_CHARGE);
    world[ny][pushX] = makeRock(nextCharge, dx);
    world[ny][nx] = makeEmpty();
    player.x = nx;
    player.y = ny;
    return;
  }

  if (target.type === TileType.SOIL) {
    world[ny][nx] = makeEmpty();
    brokenSoil += 1;
  } else if (target.type === TileType.DIAMOND) {
    world[ny][nx] = makeEmpty();
    collectedDiamonds += 1;
  } else if (
    target.type !== TileType.EMPTY
    && target.type !== TileType.WATER
    && target.type !== TileType.GOAL
    && target.type !== TileType.LAVA
  ) {
    return;
  }

  player.x = nx;
  player.y = ny;
}

function breakSoil() {
  const tx = player.x + player.facing.x;
  const ty = player.y + player.facing.y;
  if (!inBounds(tx, ty)) {
    return;
  }

  const tile = world[ty][tx];
  if (tile.type === TileType.SOIL) {
    world[ty][tx] = makeEmpty();
    brokenSoil += 1;
  }
}

function pourWaterForward() {
  const tx = player.x + player.facing.x;
  const ty = player.y + player.facing.y;
  if (!inBounds(tx, ty)) {
    return;
  }

  const tile = world[ty][tx];
  if (tile.type === TileType.EMPTY) {
    world[ty][tx] = makeWater(WATER_MAX);
    return;
  }

  if (tile.type === TileType.WATER) {
    tile.water = Math.min(tile.water + 0.5, WATER_MAX + WATER_COMPRESS * ROWS);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      drawTile(x, y, world[y][x]);
    }
  }

  drawPlayer();
  drawGrid();
}

function drawTile(x, y, tile) {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  if (tile.type === TileType.EMPTY) {
    ctx.fillStyle = "#f2efe7";
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    return;
  }

  if (tile.type === TileType.STONE) {
    ctx.fillStyle = "#7f868d";
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = "#6a7075";
    ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    return;
  }

  if (tile.type === TileType.SOIL) {
    ctx.fillStyle = "#9f7746";
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = "#835e35";
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(px + 5 + i * 6, py + 5 + (i % 2) * 8, 2, 2);
    }
    return;
  }

  if (tile.type === TileType.WATER) {
    ctx.fillStyle = "#e8f2ff";
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    const shownWater = Math.min(WATER_MAX, tile.water);
    const h = Math.max(1, Math.floor(shownWater * TILE_SIZE));
    ctx.fillStyle = "#4f9ce5";
    ctx.fillRect(px, py + TILE_SIZE - h, TILE_SIZE, h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(px + 2, py + TILE_SIZE - h + 1, TILE_SIZE - 4, 2);
    return;
  }

  if (tile.type === TileType.ROCK) {
    ctx.fillStyle = "#4f4f4f";
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#808080";
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE / 2 - 4, py + TILE_SIZE / 2 - 4, 7, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (tile.type === TileType.DIAMOND) {
    ctx.fillStyle = "#4a3c13";
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = "#66e8ff";
    ctx.beginPath();
    ctx.moveTo(px + 16, py + 4);
    ctx.lineTo(px + 26, py + 16);
    ctx.lineTo(px + 16, py + 28);
    ctx.lineTo(px + 6, py + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#baf6ff";
    ctx.fillRect(px + 14, py + 9, 4, 4);
    return;
  }

  if (tile.type === TileType.LAVA) {
    ctx.fillStyle = "#2c1405";
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = "#ff5f1f";
    ctx.beginPath();
    ctx.moveTo(px + 3, py + 24);
    ctx.lineTo(px + 8, py + 12);
    ctx.lineTo(px + 14, py + 20);
    ctx.lineTo(px + 20, py + 8);
    ctx.lineTo(px + 28, py + 24);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (tile.type === TileType.MONSTER_H) {
    drawMonster(px, py, "#9857d8");
    return;
  }

  if (tile.type === TileType.MONSTER_V) {
    drawMonster(px, py, "#2ea55f");
    return;
  }

  if (tile.type === TileType.MONSTER_WANDER) {
    drawMonster(px, py, "#d86a1f");
    return;
  }

  if (tile.type === TileType.GOAL) {
    ctx.fillStyle = "#f4cb3e";
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = "#fff3ae";
    ctx.fillRect(px + 8, py + 8, 16, 16);
    ctx.fillStyle = "#8f6f00";
    ctx.fillRect(px + 13, py + 13, 6, 6);
  }
}

function drawPlayer() {
  const px = player.x * TILE_SIZE;
  const py = player.y * TILE_SIZE;

  ctx.fillStyle = "#2e2e2e";
  ctx.fillRect(px + 7, py + 6, 18, 20);
  ctx.fillStyle = "#e1c899";
  ctx.fillRect(px + 10, py + 9, 12, 8);

  const eyeX = px + 16 + player.facing.x * 4;
  const eyeY = py + 13 + player.facing.y * 4;
  ctx.fillStyle = "#fff";
  ctx.fillRect(eyeX, eyeY, 2, 2);
}

function drawMonster(px, py, bodyColor) {
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(px + 10, py + 10, 4, 4);
  ctx.fillRect(px + 18, py + 10, 4, 4);
  ctx.fillStyle = "#111";
  ctx.fillRect(px + 11, py + 11, 2, 2);
  ctx.fillRect(px + 19, py + 11, 2, 2);
}

function drawGrid() {
  ctx.strokeStyle = "rgba(40, 40, 40, 0.08)";
  for (let x = 0; x <= COLS; x += 1) {
    const px = x * TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, ROWS * TILE_SIZE);
    ctx.stroke();
  }

  for (let y = 0; y <= ROWS; y += 1) {
    const py = y * TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(COLS * TILE_SIZE, py);
    ctx.stroke();
  }
}

function updateCamera() {
  const viewportWidth = gameWrapEl.clientWidth;
  const viewportHeight = gameWrapEl.clientHeight;
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return;
  }

  const edgeMargin = TILE_SIZE * CAMERA_EDGE_MARGIN_TILES;
  const { targetLeft, targetTop } = calculateCameraTarget({
    playerX: player.x,
    playerY: player.y,
    tileSize: TILE_SIZE,
    viewportWidth,
    viewportHeight,
    scrollLeft: cameraScrollLeft,
    scrollTop: cameraScrollTop,
    contentWidth: canvas.width,
    contentHeight: canvas.height,
    edgeMargin,
  });

  cameraScrollLeft = stepSmoothScroll(cameraScrollLeft, targetLeft, CAMERA_SMOOTHING);
  cameraScrollTop = stepSmoothScroll(cameraScrollTop, targetTop, CAMERA_SMOOTHING);
  gameWrapEl.scrollLeft = cameraScrollLeft;
  gameWrapEl.scrollTop = cameraScrollTop;
}

function buildWorld() {
  const rows = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => makeEmpty()));
  const rowCount = rows.length;
  const colCount = rowCount > 0 ? rows[0].length : 0;
  const place = (x, y, tile) => {
    if (y >= 0 && y < rowCount && x >= 0 && x < colCount) {
      rows[y][x] = tile;
    }
  };

  for (let x = 0; x < colCount; x += 1) {
    place(x, rowCount - 1, makeStone());
    if (x % 3 !== 0 && rowCount >= 2) {
      place(x, rowCount - 2, makeSoil());
    }
  }

  for (let y = 6; y < rowCount - 3; y += 1) {
    place(0, y, makeStone());
    place(colCount - 1, y, makeStone());
  }

  for (let x = 6; x < 18; x += 1) {
    place(x, 8, makeStone());
  }

  for (let y = 4; y < 10; y += 1) {
    place(5, y, makeSoil());
  }

  for (let x = 13; x < 21; x += 1) {
    place(x, 5, makeSoil());
  }

  place(10, 2, makeWater(1));
  place(11, 2, makeWater(1));
  place(12, 2, makeWater(1));
  place(12, 3, makeWater(0.5));
  place(17, 7, makeRock());
  place(15, 3, makeRock());
  place(16, 3, makeRock());
  place(7, 4, makeDiamond());
  place(8, 4, makeDiamond());
  place(18, 9, makeDiamond());
  place(19, 9, makeDiamond());
  place(4, 11, makeLava());
  place(5, 11, makeLava());
  place(6, 11, makeLava());
  place(8, 11, makeMonsterHorizontal(1));
  place(14, 11, makeMonsterVertical(1));
  place(20, 6, makeMonsterWander(-1, 0));
  place(21, 2, makeGoal());

  return rows;
}

function copyInto(dest, src) {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      dest[y][x] = src[y][x];
    }
  }
}

function inBounds(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function hasRockSupport(x, y) {
  if (!inBounds(x, y + 1)) {
    return true;
  }

  const below = world[y + 1][x];
  return below.type === TileType.STONE || below.type === TileType.ROCK;
}
