import {
  TileType,
  canHoldWater,
  getWaterAmount,
  isMonsterType,
  makeDiamond,
  makeEmpty,
  makeGoal,
  getTileObject,
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
import { collectTransitioningTiles } from "./systems/transitionRenderSystem.js";
import {
  GITHUB_AUTH_PENDING_KEY,
  GITHUB_AUTH_STORAGE_KEY,
  buildGitHubAuthorizeUrl,
  buildOAuthRedirectUri,
  createPkceChallenge,
  createPkceVerifier,
  formatGitHubCallbackDiagnostics,
  formatGitHubTokenExchangeError,
  getGitHubAuthUnavailableMessage,
  isGitHubAuthSession,
  parseGitHubCallbackParams,
  parseGitHubTokenEndpointResponse,
  resolveGitHubClientId,
  resolveGitHubTokenExchangeUrl,
} from "./systems/githubAuthSystem.js";

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
const GITHUB_OAUTH_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const GITHUB_TOKEN_ERROR_SUMMARY_MAX_LENGTH = 180;
const PORTAL_TOKEN_KEY = "vgPortal.token";
const PORTAL_USER_KEY = "vgPortal.user";
const ROCK_STEP_FRAMES_1X = 2;
const MONSTER_STEP_FRAMES_1X = 3;
const DEFAULT_TRANSITION_FRAMES = 1;
const CAMERA_EDGE_MARGIN_TILES = 3;
const CAMERA_SMOOTHING = 0.2;
const DEFAULT_TICK_INTERVAL_MULTIPLIER = 2;
const ALLOWED_TICK_SPEED_MULTIPLIERS = new Set([0.5, 1, 2, 3, 4]);
const MOVE_KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
const ACTION_KEYS = ["f", " "];
const OBJECT_TRANSITION_FRAMES = {
  [TileType.ROCK]: ROCK_STEP_FRAMES_1X,
  [TileType.DIAMOND]: ROCK_STEP_FRAMES_1X,
  [TileType.MONSTER_H]: MONSTER_STEP_FRAMES_1X,
  [TileType.MONSTER_V]: MONSTER_STEP_FRAMES_1X,
  [TileType.MONSTER_WANDER]: MONSTER_STEP_FRAMES_1X,
};

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
const toolsEl = document.getElementById("tools");
const winOverlayEl = document.getElementById("winOverlay");
const playAgainBtn = document.getElementById("playAgainBtn");
const playBtn = document.getElementById("playBtn");
const editBtn = document.getElementById("editBtn");
const tickIntervalSelectEl = document.getElementById("tickIntervalSelect");
const githubAuthBtn = document.getElementById("githubAuthBtn");
const githubAuthStatusEl = document.getElementById("githubAuthStatus");
const saveMapBtn = document.getElementById("saveMapBtn");
const exitPlayBtn = document.getElementById("exitPlayBtn");
const edgeControlsEl = document.getElementById("edgeControls");
const touchControlsEl = document.getElementById("touchControls");
const mapResizeEl = document.querySelector(".map-resize");
const gameWrapEl = document.querySelector(".game-wrap");
const githubClientMetaEl = document.querySelector('meta[name="github-client-id"]');
const githubTokenExchangeMetaEl = document.querySelector('meta[name="github-token-exchange-url"]');
const portalUrlMetaEl = document.querySelector('meta[name="portal-url"]');
const githubClientId = resolveGitHubClientId(githubClientMetaEl?.content, window.VIBE_GITHUB_CLIENT_ID);
const githubTokenExchangeUrl = resolveGitHubTokenExchangeUrl(
  githubTokenExchangeMetaEl?.content,
  window.VIBE_GITHUB_TOKEN_EXCHANGE_URL,
);
const portalUrl = portalUrlMetaEl?.content?.trim() || "/portal";
const githubAuthUnavailableMessage = getGitHubAuthUnavailableMessage();
const pixelEditorEl = document.getElementById("pixelEditor");
const pixelEditorTitleEl = document.getElementById("pixelEditorTitle");
const pixelEditorCanvasEl = document.getElementById("pixelEditorCanvas");
const pixelEditorPaletteEl = document.getElementById("pixelEditorPalette");
const pixelEditorCurrentColorEl = document.getElementById("pixelEditorCurrentColor");
const pixelEditorCustomColorEl = document.getElementById("pixelEditorCustomColor");
const pixelEditorSaveBtn = document.getElementById("pixelEditorSave");
const pixelEditorCancelBtn = document.getElementById("pixelEditorCancel");
const pixelEditorResetBtn = document.getElementById("pixelEditorReset");
const pixelEditorToolboxEl = document.getElementById("pixelEditorToolbox");

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
let tickIntervalMultiplier = DEFAULT_TICK_INTERVAL_MULTIPLIER;
let isGitHubAuthLoading = false;

const PIXEL_EDITOR_ZOOM = 10;
const PIXEL_EDITOR_TILE_SIZE = 32;
const SELECTION_HANDLE_HIT_THRESHOLD = 6;
const SELECTION_DASH_LENGTH = 4;
const PIXEL_EDITOR_PALETTE_COLORS = [
  "#000000", "#444444", "#888888", "#cccccc", "#ffffff",
  "#7f868d", "#4f4f4f", "#808080", "#565656", "#9f7746",
  "#835e35", "#c8a870", "#4f9ce5", "#e8f2ff", "#2270c0",
  "#4a3c13", "#66e8ff", "#baf6ff", "#2c1405", "#ff5f1f",
  "#9857d8", "#2ea55f", "#d86a1f", "#f4cb3e", "#fff3ae",
  "#8f6f00", "#e1c899", "#2e2e2e", "#f2efe7", "transparent",
];

const TOOL_TILE_TYPE_MAP = {
  stone: TileType.STONE,
  soil: TileType.SOIL,
  water: TileType.WATER,
  rock: TileType.ROCK,
  diamond: TileType.DIAMOND,
  lava: TileType.LAVA,
  monsterH: TileType.MONSTER_H,
  monsterV: TileType.MONSTER_V,
  monsterWander: TileType.MONSTER_WANDER,
};

const customTileCanvases = new Map();

let pixelEditorActiveTileType = null;
let pixelEditorEditCanvas = null;
let pixelEditorEditCtx = null;
let pixelEditorSelectedColor = "#7f868d";
let pixelEditorIsPainting = false;
let pixelEditorActiveTool = "draw";
let pixelEditorPenSize = 1;
let pixelEditorShapeStart = null;
let pixelEditorShapeSnapshot = null;
let pixelEditorSelection = null;                  // { x, y, w, h } in tile pixel coords, null = no selection
let pixelEditorSelectionClipboard = null;         // HTMLCanvasElement with copied pixels
let pixelEditorSelectionDragMode = null;          // null, "new", "move", or "resize-" + direction ("nw","n","ne","e","se","s","sw","w")
let pixelEditorSelectionDragStart = null;         // { px, py } tile pixel coords at drag start
let pixelEditorSelectionDragOrigSel = null;       // { x, y, w, h } selection at drag start
let pixelEditorSelectionFloatCanvas = null;       // HTMLCanvasElement with floating pixels (during move)
let pixelEditorSelectionBaseSnapshot = null;      // ImageData of canvas with hole cut out (during move)

const gameContext = {
  githubAuth: null,
};
window.vibeGameContext = gameContext;

window.addEventListener("keydown", onKeyDown);
window.addEventListener("paste", onPaste);
canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mousemove", onMouseMove);
window.addEventListener("mouseup", onMouseUp);
canvas.addEventListener("mouseleave", onMouseLeave);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("dblclick", onCanvasDoubleClick);
toolsEl.addEventListener("click", onToolClick);
toolsEl.addEventListener("dblclick", onToolDoubleClick);
playAgainBtn.addEventListener("click", resetGame);
playBtn.addEventListener("click", startPlay);
editBtn.addEventListener("click", startEdit);
tickIntervalSelectEl.addEventListener("change", onTickIntervalChange);
githubAuthBtn.addEventListener("click", onGitHubAuthClick);
exitPlayBtn.addEventListener("click", startEdit);
saveMapBtn.addEventListener("click", onSaveMapClick);
edgeControlsEl.addEventListener("click", onExpandEdgeClick);
touchControlsEl.addEventListener("pointerdown", onTouchControlPointerDown);
new ResizeObserver(onMapResize).observe(mapResizeEl);
edgeControlsEl.style.width = `${canvas.width}px`;
edgeControlsEl.style.height = `${canvas.height}px`;

pixelEditorSaveBtn.addEventListener("click", savePixelEditor);
pixelEditorCancelBtn.addEventListener("click", closePixelEditor);
pixelEditorResetBtn.addEventListener("click", resetPixelEditor);
pixelEditorCanvasEl.addEventListener("mousedown", onPixelEditorMouseDown);
pixelEditorCanvasEl.addEventListener("mousemove", onPixelEditorMouseMove);
pixelEditorCanvasEl.addEventListener("mouseup", onPixelEditorPaintEnd);
pixelEditorCanvasEl.addEventListener("mouseleave", onPixelEditorPaintEnd);
pixelEditorCustomColorEl.addEventListener("input", onPixelEditorCustomColorChange);
pixelEditorToolboxEl.addEventListener("click", onPixelEditorToolboxClick);

initPixelEditorPalette();

void initializeGitHubAuth();
updateHud();
updateToolPreviews();
scheduleToolPreviewsOnImageLoad();
requestAnimationFrame(loop);

function loop() {
  if (appMode === "play" && gameState === "playing") {
    rockFrameCounter += 1;
    monsterFrameCounter += 1;

    const rockStepFrames = getRockStepFrames();
    const monsterStepFrames = getMonsterStepFrames();
    const shouldTickRocks = rockFrameCounter >= rockStepFrames;
    const shouldTickMonsters = monsterFrameCounter >= monsterStepFrames;

    if (shouldTickRocks || shouldTickMonsters) {
      rockRollBias = tickWorldObjects({
        world,
        rows: ROWS,
        cols: COLS,
        inBounds,
        makeEmpty,
        makeRock,
        makeDiamond,
        makeLava,
        player,
        setGameState,
        rollBias: rockRollBias,
        shouldTickType: (type) => ((type === TileType.ROCK || type === TileType.DIAMOND || type === TileType.LAVA) && shouldTickRocks)
          || (isMonsterType(type) && shouldTickMonsters),
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

  stepObjectTransitions();
  updateHud();
  draw();
  requestAnimationFrame(loop);
}

function setGameState(nextState, reason) {
  if (gameState !== "playing") {
    return;
  }

  gameState = nextState;

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

function onToolDoubleClick(event) {
  const button = event.target.closest("button[data-tool]");
  if (!button) {
    return;
  }

  const tileType = TOOL_TILE_TYPE_MAP[button.dataset.tool];
  if (!tileType) {
    return;
  }

  openPixelEditor(tileType);
}

function onTickIntervalChange() {
  const nextSpeedMultiplier = Number(tickIntervalSelectEl.value);
  if (!ALLOWED_TICK_SPEED_MULTIPLIERS.has(nextSpeedMultiplier)) {
    tickIntervalMultiplier = DEFAULT_TICK_INTERVAL_MULTIPLIER;
    tickIntervalSelectEl.value = "1";
    return;
  }
  tickIntervalMultiplier = DEFAULT_TICK_INTERVAL_MULTIPLIER / nextSpeedMultiplier;
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

function onCanvasDoubleClick(event) {
  if (appMode !== "edit") {
    return;
  }

  const point = getMouseTile(event);
  if (!point) {
    return;
  }

  const tile = world[point.y][point.x];
  if (!tile || tile.type === TileType.EMPTY) {
    return;
  }

  openPixelEditor(tile.type);
}

function getTileTypeName(tileType) {
  const names = {
    [TileType.STONE]: "Stone",
    [TileType.SOIL]: "Soil",
    [TileType.WATER]: "Water",
    [TileType.ROCK]: "Rock",
    [TileType.DIAMOND]: "Diamond",
    [TileType.LAVA]: "Lava",
    [TileType.MONSTER_H]: "Monster ↔",
    [TileType.MONSTER_V]: "Monster ↕",
    [TileType.MONSTER_WANDER]: "Monster ?",
    [TileType.GOAL]: "Goal",
    [TileType.EMPTY]: "Empty",
  };
  return names[tileType] || tileType;
}

function captureTileAppearance(tileType) {
  const offscreen = document.createElement("canvas");
  offscreen.width = PIXEL_EDITOR_TILE_SIZE;
  offscreen.height = PIXEL_EDITOR_TILE_SIZE;
  const offCtx = offscreen.getContext("2d");

  const customCanvas = customTileCanvases.get(tileType);
  if (customCanvas) {
    offCtx.drawImage(customCanvas, 0, 0);
  } else {
    const tileObject = getTileObject(tileType);
    const mockTile = { type: tileType, water: WATER_MAX };
    tileObject.draw({ ctx: offCtx, tile: mockTile, px: 0, py: 0, tileSize: PIXEL_EDITOR_TILE_SIZE });
  }

  return offscreen;
}

function openPixelEditor(tileType) {
  pixelEditorActiveTileType = tileType;

  const srcCanvas = captureTileAppearance(tileType);

  pixelEditorEditCanvas = document.createElement("canvas");
  pixelEditorEditCanvas.width = PIXEL_EDITOR_TILE_SIZE;
  pixelEditorEditCanvas.height = PIXEL_EDITOR_TILE_SIZE;
  pixelEditorEditCtx = pixelEditorEditCanvas.getContext("2d");
  pixelEditorEditCtx.drawImage(srcCanvas, 0, 0);

  pixelEditorTitleEl.textContent = `Edit Tile: ${getTileTypeName(tileType)}`;
  pixelEditorEl.classList.remove("hidden");

  setPixelEditorTool("draw");
  setPixelEditorPenSize(1);

  renderPixelEditorView();
}

function closePixelEditor() {
  pixelEditorEl.classList.add("hidden");
  pixelEditorActiveTileType = null;
  pixelEditorEditCanvas = null;
  pixelEditorEditCtx = null;
  pixelEditorIsPainting = false;
  pixelEditorShapeStart = null;
  pixelEditorShapeSnapshot = null;
  pixelEditorSelection = null;
  pixelEditorSelectionDragMode = null;
  pixelEditorSelectionDragStart = null;
  pixelEditorSelectionDragOrigSel = null;
  pixelEditorSelectionFloatCanvas = null;
  pixelEditorSelectionBaseSnapshot = null;
}

function resetPixelEditor() {
  if (!pixelEditorActiveTileType) {
    return;
  }

  const freshCanvas = document.createElement("canvas");
  freshCanvas.width = PIXEL_EDITOR_TILE_SIZE;
  freshCanvas.height = PIXEL_EDITOR_TILE_SIZE;
  const freshCtx = freshCanvas.getContext("2d");
  const tileObject = getTileObject(pixelEditorActiveTileType);
  const mockTile = { type: pixelEditorActiveTileType, water: WATER_MAX };
  tileObject.draw({ ctx: freshCtx, tile: mockTile, px: 0, py: 0, tileSize: PIXEL_EDITOR_TILE_SIZE });

  pixelEditorEditCtx.clearRect(0, 0, PIXEL_EDITOR_TILE_SIZE, PIXEL_EDITOR_TILE_SIZE);
  pixelEditorEditCtx.drawImage(freshCanvas, 0, 0);

  renderPixelEditorView();
}

function savePixelEditor() {
  if (!pixelEditorActiveTileType || !pixelEditorEditCanvas) {
    return;
  }

  const savedCanvas = document.createElement("canvas");
  savedCanvas.width = PIXEL_EDITOR_TILE_SIZE;
  savedCanvas.height = PIXEL_EDITOR_TILE_SIZE;
  const savedCtx = savedCanvas.getContext("2d");
  savedCtx.drawImage(pixelEditorEditCanvas, 0, 0);
  customTileCanvases.set(pixelEditorActiveTileType, savedCanvas);

  updateToolPreviews();
  closePixelEditor();
}

function renderPixelEditorView() {
  if (!pixelEditorEditCtx) {
    return;
  }

  const editorCtx = pixelEditorCanvasEl.getContext("2d");
  const imageData = pixelEditorEditCtx.getImageData(0, 0, PIXEL_EDITOR_TILE_SIZE, PIXEL_EDITOR_TILE_SIZE);

  editorCtx.clearRect(0, 0, pixelEditorCanvasEl.width, pixelEditorCanvasEl.height);

  for (let py = 0; py < PIXEL_EDITOR_TILE_SIZE; py += 1) {
    for (let px = 0; px < PIXEL_EDITOR_TILE_SIZE; px += 1) {
      const idx = (py * PIXEL_EDITOR_TILE_SIZE + px) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      const a = imageData.data[idx + 3];

      const screenX = px * PIXEL_EDITOR_ZOOM;
      const screenY = py * PIXEL_EDITOR_ZOOM;

      if (a < 255) {
        const checker = (Math.floor(px / 2) + Math.floor(py / 2)) % 2 === 0;
        editorCtx.fillStyle = checker ? "#bbb" : "#888";
        editorCtx.fillRect(screenX, screenY, PIXEL_EDITOR_ZOOM, PIXEL_EDITOR_ZOOM);
      }

      if (a > 0) {
        editorCtx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
        editorCtx.fillRect(screenX, screenY, PIXEL_EDITOR_ZOOM, PIXEL_EDITOR_ZOOM);
      }
    }
  }

  editorCtx.strokeStyle = "rgba(0,0,0,0.15)";
  editorCtx.lineWidth = 0.5;
  for (let i = 0; i <= PIXEL_EDITOR_TILE_SIZE; i += 1) {
    const pos = i * PIXEL_EDITOR_ZOOM;
    editorCtx.beginPath();
    editorCtx.moveTo(pos, 0);
    editorCtx.lineTo(pos, pixelEditorCanvasEl.height);
    editorCtx.stroke();
    editorCtx.beginPath();
    editorCtx.moveTo(0, pos);
    editorCtx.lineTo(pixelEditorCanvasEl.width, pos);
    editorCtx.stroke();
  }

  if (pixelEditorSelection) {
    renderSelectionOverlay(editorCtx);
  }
}

function getPixelEditorCoords(event) {
  const rect = pixelEditorCanvasEl.getBoundingClientRect();
  const scaleX = pixelEditorCanvasEl.width / rect.width;
  const scaleY = pixelEditorCanvasEl.height / rect.height;
  const screenX = (event.clientX - rect.left) * scaleX;
  const screenY = (event.clientY - rect.top) * scaleY;
  const px = Math.floor(screenX / PIXEL_EDITOR_ZOOM);
  const py = Math.floor(screenY / PIXEL_EDITOR_ZOOM);

  if (px < 0 || px >= PIXEL_EDITOR_TILE_SIZE || py < 0 || py >= PIXEL_EDITOR_TILE_SIZE) {
    return null;
  }

  return { px, py };
}

function paintPixelEditorPixelRaw(px, py) {
  if (!pixelEditorEditCtx) {
    return;
  }

  if (px < 0 || px >= PIXEL_EDITOR_TILE_SIZE || py < 0 || py >= PIXEL_EDITOR_TILE_SIZE) {
    return;
  }

  // Pen brush is a square centered on the target pixel.
  const half = Math.floor(pixelEditorPenSize / 2);
  const startX = Math.max(0, px - half);
  const startY = Math.max(0, py - half);
  const endX = Math.min(PIXEL_EDITOR_TILE_SIZE, px - half + pixelEditorPenSize);
  const endY = Math.min(PIXEL_EDITOR_TILE_SIZE, py - half + pixelEditorPenSize);
  const w = endX - startX;
  const h = endY - startY;

  if (w <= 0 || h <= 0) {
    return;
  }

  if (pixelEditorSelectedColor === "transparent") {
    pixelEditorEditCtx.clearRect(startX, startY, w, h);
  } else {
    pixelEditorEditCtx.fillStyle = pixelEditorSelectedColor;
    pixelEditorEditCtx.fillRect(startX, startY, w, h);
  }
}

function paintPixelEditorPixel(px, py) {
  paintPixelEditorPixelRaw(px, py);
  renderPixelEditorView();
}

function floodFill(startPx, startPy) {
  if (!pixelEditorEditCtx) {
    return;
  }

  const imageData = pixelEditorEditCtx.getImageData(0, 0, PIXEL_EDITOR_TILE_SIZE, PIXEL_EDITOR_TILE_SIZE);
  const data = imageData.data;
  const idx = (startPy * PIXEL_EDITOR_TILE_SIZE + startPx) * 4;
  const targetR = data[idx];
  const targetG = data[idx + 1];
  const targetB = data[idx + 2];
  const targetA = data[idx + 3];

  let fillR, fillG, fillB, fillA;
  if (pixelEditorSelectedColor === "transparent") {
    fillR = 0; fillG = 0; fillB = 0; fillA = 0;
  } else {
    const hex = pixelEditorSelectedColor.replace("#", "");
    fillR = parseInt(hex.slice(0, 2), 16);
    fillG = parseInt(hex.slice(2, 4), 16);
    fillB = parseInt(hex.slice(4, 6), 16);
    fillA = 255;
  }

  if (fillR === targetR && fillG === targetG && fillB === targetB && fillA === targetA) {
    return;
  }

  const size = PIXEL_EDITOR_TILE_SIZE;
  const stack = [[startPx, startPy]];
  const visited = new Uint8Array(size * size);

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= size || y < 0 || y >= size) {
      continue;
    }
    const key = y * size + x;
    if (visited[key]) {
      continue;
    }
    const i = key * 4;
    if (data[i] !== targetR || data[i + 1] !== targetG || data[i + 2] !== targetB || data[i + 3] !== targetA) {
      continue;
    }
    visited[key] = 1;
    data[i] = fillR;
    data[i + 1] = fillG;
    data[i + 2] = fillB;
    data[i + 3] = fillA;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  pixelEditorEditCtx.putImageData(imageData, 0, 0);
  renderPixelEditorView();
}

function pickEditorColor(px, py) {
  if (!pixelEditorEditCtx) {
    return;
  }

  const imageData = pixelEditorEditCtx.getImageData(px, py, 1, 1);
  const [r, g, b, a] = imageData.data;
  if (a === 0) {
    setPixelEditorColor("transparent");
  } else {
    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    setPixelEditorColor(hex);
    pixelEditorCustomColorEl.value = hex;
  }

  setPixelEditorTool("draw");
}

// Bresenham's line algorithm.
function drawEditorLine(x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  for (;;) {
    paintPixelEditorPixelRaw(x0, y0);
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  renderPixelEditorView();
}

// Draws the outline of an axis-aligned rectangle.
function drawEditorRect(x0, y0, x1, y1) {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  for (let x = minX; x <= maxX; x++) {
    paintPixelEditorPixelRaw(x, minY);
    paintPixelEditorPixelRaw(x, maxY);
  }
  for (let y = minY + 1; y < maxY; y++) {
    paintPixelEditorPixelRaw(minX, y);
    paintPixelEditorPixelRaw(maxX, y);
  }

  renderPixelEditorView();
}

// Midpoint circle algorithm. cx/cy is the center; x1/y1 determines the radius.
function drawEditorCircle(cx, cy, x1, y1) {
  let r = Math.round(Math.sqrt((x1 - cx) ** 2 + (y1 - cy) ** 2));
  if (r === 0) {
    paintPixelEditorPixelRaw(cx, cy);
    renderPixelEditorView();
    return;
  }

  let x = r;
  let y = 0;
  let err = 0;

  while (x >= y) {
    paintPixelEditorPixelRaw(cx + x, cy + y);
    paintPixelEditorPixelRaw(cx + y, cy + x);
    paintPixelEditorPixelRaw(cx - y, cy + x);
    paintPixelEditorPixelRaw(cx - x, cy + y);
    paintPixelEditorPixelRaw(cx - x, cy - y);
    paintPixelEditorPixelRaw(cx - y, cy - x);
    paintPixelEditorPixelRaw(cx + y, cy - x);
    paintPixelEditorPixelRaw(cx + x, cy - y);
    y++;
    err += 2 * y + 1;
    if (err >= 2 * x) {
      x--;
      err -= 2 * x + 1;
    }
  }

  renderPixelEditorView();
}

function isPixelEditorShapeTool() {
  return pixelEditorActiveTool === "line" || pixelEditorActiveTool === "rect" || pixelEditorActiveTool === "circle";
}

const PIXEL_EDITOR_HANDLE_CURSORS = {
  nw: "nw-resize", n: "n-resize", ne: "ne-resize",
  e: "e-resize", se: "se-resize", s: "s-resize",
  sw: "sw-resize", w: "w-resize",
};

function getCanvasScreenCoords(event) {
  const rect = pixelEditorCanvasEl.getBoundingClientRect();
  const scaleX = pixelEditorCanvasEl.width / rect.width;
  const scaleY = pixelEditorCanvasEl.height / rect.height;
  return {
    sx: (event.clientX - rect.left) * scaleX,
    sy: (event.clientY - rect.top) * scaleY,
  };
}

function getPixelEditorCoordsClamped(event) {
  const rect = pixelEditorCanvasEl.getBoundingClientRect();
  const scaleX = pixelEditorCanvasEl.width / rect.width;
  const scaleY = pixelEditorCanvasEl.height / rect.height;
  const screenX = (event.clientX - rect.left) * scaleX;
  const screenY = (event.clientY - rect.top) * scaleY;
  const px = Math.max(0, Math.min(PIXEL_EDITOR_TILE_SIZE - 1, Math.floor(screenX / PIXEL_EDITOR_ZOOM)));
  const py = Math.max(0, Math.min(PIXEL_EDITOR_TILE_SIZE - 1, Math.floor(screenY / PIXEL_EDITOR_ZOOM)));
  return { px, py };
}

function getSelectionHandleAt(sx, sy) {
  if (!pixelEditorSelection) {
    return null;
  }
  const { x, y, w, h } = pixelEditorSelection;
  const l = x * PIXEL_EDITOR_ZOOM;
  const t = y * PIXEL_EDITOR_ZOOM;
  const r = (x + w) * PIXEL_EDITOR_ZOOM;
  const b = (y + h) * PIXEL_EDITOR_ZOOM;
  const mx = (l + r) / 2;
  const my = (t + b) / 2;
  const HIT = SELECTION_HANDLE_HIT_THRESHOLD;
  const handles = [
    ["nw", l, t], ["n", mx, t], ["ne", r, t],
    ["e", r, my],
    ["se", r, b], ["s", mx, b], ["sw", l, b],
    ["w", l, my],
  ];
  for (const [name, hx, hy] of handles) {
    if (Math.abs(sx - hx) <= HIT && Math.abs(sy - hy) <= HIT) {
      return name;
    }
  }
  return null;
}

function isInsideSelection(px, py) {
  if (!pixelEditorSelection) {
    return false;
  }
  const { x, y, w, h } = pixelEditorSelection;
  return px >= x && px < x + w && py >= y && py < y + h;
}

function renderSelectionOverlay(editorCtx) {
  if (!pixelEditorSelection) {
    return;
  }
  const { x, y, w, h } = pixelEditorSelection;
  const sx = x * PIXEL_EDITOR_ZOOM;
  const sy = y * PIXEL_EDITOR_ZOOM;
  const sw = w * PIXEL_EDITOR_ZOOM;
  const sh = h * PIXEL_EDITOR_ZOOM;

  editorCtx.save();
  editorCtx.lineWidth = 1;
  editorCtx.setLineDash([SELECTION_DASH_LENGTH, SELECTION_DASH_LENGTH]);
  editorCtx.strokeStyle = "#fff";
  editorCtx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
  editorCtx.strokeStyle = "#000";
  editorCtx.lineDashOffset = SELECTION_DASH_LENGTH;
  editorCtx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
  editorCtx.setLineDash([]);

  const l = sx, t = sy, r = sx + sw, b = sy + sh;
  const midX = (l + r) / 2, midY = (t + b) / 2;
  for (const [hx, hy] of [[l, t], [midX, t], [r, t], [r, midY], [r, b], [midX, b], [l, b], [l, midY]]) {
    editorCtx.fillStyle = "#fff";
    editorCtx.fillRect(hx - 3, hy - 3, 6, 6);
    editorCtx.strokeStyle = "#000";
    editorCtx.lineWidth = 1;
    editorCtx.strokeRect(hx - 3, hy - 3, 6, 6);
  }
  editorCtx.restore();
}

function commitSelectionFloat() {
  // The canvas already has the floating pixels drawn at the current position.
  // Just clear the float state.
  pixelEditorSelectionFloatCanvas = null;
  pixelEditorSelectionBaseSnapshot = null;
}

function startSelectionMove(px, py) {
  if (!pixelEditorSelection || !pixelEditorEditCtx) {
    return;
  }
  const sel = pixelEditorSelection;

  // Extract the pixels in the selected area.
  const floatData = pixelEditorEditCtx.getImageData(sel.x, sel.y, sel.w, sel.h);

  // Clear the selected area from the canvas.
  pixelEditorEditCtx.clearRect(sel.x, sel.y, sel.w, sel.h);

  // Capture the base canvas state (canvas with hole).
  pixelEditorSelectionBaseSnapshot = pixelEditorEditCtx.getImageData(0, 0, PIXEL_EDITOR_TILE_SIZE, PIXEL_EDITOR_TILE_SIZE);

  // Create a canvas holding just the floating pixels.
  pixelEditorSelectionFloatCanvas = document.createElement("canvas");
  pixelEditorSelectionFloatCanvas.width = sel.w;
  pixelEditorSelectionFloatCanvas.height = sel.h;
  pixelEditorSelectionFloatCanvas.getContext("2d").putImageData(floatData, 0, 0);

  // Draw float back at its original position so the visual is unchanged.
  pixelEditorEditCtx.drawImage(pixelEditorSelectionFloatCanvas, sel.x, sel.y);

  pixelEditorSelectionDragMode = "move";
  pixelEditorSelectionDragStart = { px, py };
  pixelEditorSelectionDragOrigSel = { ...sel };
}

function copySelectionToClipboard() {
  if (!pixelEditorSelection || !pixelEditorEditCtx) {
    return;
  }
  const { x, y, w, h } = pixelEditorSelection;
  const imageData = pixelEditorSelectionFloatCanvas
    ? pixelEditorSelectionFloatCanvas.getContext("2d").getImageData(0, 0, w, h)
    : pixelEditorEditCtx.getImageData(x, y, w, h);

  pixelEditorSelectionClipboard = document.createElement("canvas");
  pixelEditorSelectionClipboard.width = w;
  pixelEditorSelectionClipboard.height = h;
  pixelEditorSelectionClipboard.getContext("2d").putImageData(imageData, 0, 0);
}

function cutSelection() {
  if (!pixelEditorSelection || !pixelEditorEditCtx) {
    return;
  }
  if (pixelEditorSelectionFloatCanvas) {
    commitSelectionFloat();
  }
  copySelectionToClipboard();
  const { x, y, w, h } = pixelEditorSelection;
  pixelEditorEditCtx.clearRect(x, y, w, h);
  renderPixelEditorView();
}

function pasteFromInternalClipboard() {
  if (!pixelEditorSelectionClipboard || !pixelEditorEditCtx) {
    return;
  }
  if (pixelEditorSelection) {
    const { x, y, w, h } = pixelEditorSelection;
    pixelEditorEditCtx.drawImage(pixelEditorSelectionClipboard, x, y, w, h);
  } else {
    pixelEditorEditCtx.clearRect(0, 0, PIXEL_EDITOR_TILE_SIZE, PIXEL_EDITOR_TILE_SIZE);
    pixelEditorEditCtx.drawImage(pixelEditorSelectionClipboard, 0, 0, PIXEL_EDITOR_TILE_SIZE, PIXEL_EDITOR_TILE_SIZE);
  }
  renderPixelEditorView();
}

function drawActiveShape(start, end) {
  if (pixelEditorActiveTool === "line") {
    drawEditorLine(start.px, start.py, end.px, end.py);
  } else if (pixelEditorActiveTool === "rect") {
    drawEditorRect(start.px, start.py, end.px, end.py);
  } else if (pixelEditorActiveTool === "circle") {
    drawEditorCircle(start.px, start.py, end.px, end.py);
  }
}

function setPixelEditorTool(tool) {
  if (tool !== "select") {
    if (pixelEditorSelectionFloatCanvas) {
      commitSelectionFloat();
    }
    pixelEditorSelection = null;
    pixelEditorSelectionDragMode = null;
    pixelEditorSelectionDragStart = null;
    pixelEditorSelectionDragOrigSel = null;
    renderPixelEditorView();
  }
  pixelEditorActiveTool = tool;
  const toolBtns = pixelEditorToolboxEl.querySelectorAll(".px-tool");
  for (const btn of toolBtns) {
    const isActive = btn.dataset.pxTool === tool;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  }
  pixelEditorCanvasEl.style.cursor = tool === "picker" ? "cell" : "crosshair";
}

function setPixelEditorPenSize(size) {
  pixelEditorPenSize = size;
  const sizeBtns = pixelEditorToolboxEl.querySelectorAll(".px-pen-size");
  for (const btn of sizeBtns) {
    const isActive = Number(btn.dataset.penSize) === size;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  }
}

function onPixelEditorToolboxClick(event) {
  const toolBtn = event.target.closest(".px-tool");
  if (toolBtn) {
    setPixelEditorTool(toolBtn.dataset.pxTool);
    return;
  }
  const sizeBtn = event.target.closest(".px-pen-size");
  if (sizeBtn) {
    setPixelEditorPenSize(Number(sizeBtn.dataset.penSize));
  }
}

function onPixelEditorMouseDown(event) {
  if (event.button !== 0) {
    return;
  }

  if (pixelEditorActiveTool === "select") {
    const coordsClamped = getPixelEditorCoordsClamped(event);
    const { sx, sy } = getCanvasScreenCoords(event);
    const handle = pixelEditorSelection ? getSelectionHandleAt(sx, sy) : null;

    if (handle) {
      pixelEditorSelectionDragMode = "resize-" + handle;
      pixelEditorSelectionDragStart = { px: coordsClamped.px, py: coordsClamped.py };
      pixelEditorSelectionDragOrigSel = { ...pixelEditorSelection };
      return;
    }

    if (pixelEditorSelection && isInsideSelection(coordsClamped.px, coordsClamped.py)) {
      startSelectionMove(coordsClamped.px, coordsClamped.py);
      return;
    }

    // Click outside any existing selection: start drawing a new selection.
    if (pixelEditorSelectionFloatCanvas) {
      commitSelectionFloat();
    }
    pixelEditorSelection = null;
    pixelEditorSelectionDragMode = "new";
    pixelEditorSelectionDragStart = { px: coordsClamped.px, py: coordsClamped.py };
    renderPixelEditorView();
    return;
  }

  const coords = getPixelEditorCoords(event);
  if (!coords) {
    return;
  }

  if (pixelEditorActiveTool === "fill") {
    floodFill(coords.px, coords.py);
    return;
  }

  if (pixelEditorActiveTool === "picker") {
    pickEditorColor(coords.px, coords.py);
    return;
  }

  if (isPixelEditorShapeTool()) {
    pixelEditorShapeStart = { px: coords.px, py: coords.py };
    pixelEditorShapeSnapshot = pixelEditorEditCtx.getImageData(0, 0, PIXEL_EDITOR_TILE_SIZE, PIXEL_EDITOR_TILE_SIZE);
    pixelEditorIsPainting = true;
    return;
  }

  pixelEditorIsPainting = true;
  paintPixelEditorPixel(coords.px, coords.py);
}

function onPixelEditorMouseMove(event) {
  if (pixelEditorActiveTool === "select") {
    const coordsClamped = getPixelEditorCoordsClamped(event);
    const { sx, sy } = getCanvasScreenCoords(event);

    if (!pixelEditorSelectionDragMode) {
      // Update cursor to reflect what a click here would do.
      const handle = pixelEditorSelection ? getSelectionHandleAt(sx, sy) : null;
      if (handle) {
        pixelEditorCanvasEl.style.cursor = PIXEL_EDITOR_HANDLE_CURSORS[handle];
      } else if (pixelEditorSelection && isInsideSelection(coordsClamped.px, coordsClamped.py)) {
        pixelEditorCanvasEl.style.cursor = "move";
      } else {
        pixelEditorCanvasEl.style.cursor = "crosshair";
      }
      return;
    }

    if (pixelEditorSelectionDragMode === "new") {
      const x0 = pixelEditorSelectionDragStart.px;
      const y0 = pixelEditorSelectionDragStart.py;
      pixelEditorSelection = {
        x: Math.min(x0, coordsClamped.px),
        y: Math.min(y0, coordsClamped.py),
        w: Math.abs(coordsClamped.px - x0) + 1,
        h: Math.abs(coordsClamped.py - y0) + 1,
      };
      renderPixelEditorView();
      return;
    }

    if (pixelEditorSelectionDragMode === "move") {
      const dx = coordsClamped.px - pixelEditorSelectionDragStart.px;
      const dy = coordsClamped.py - pixelEditorSelectionDragStart.py;
      const orig = pixelEditorSelectionDragOrigSel;
      const newX = Math.max(0, Math.min(PIXEL_EDITOR_TILE_SIZE - orig.w, orig.x + dx));
      const newY = Math.max(0, Math.min(PIXEL_EDITOR_TILE_SIZE - orig.h, orig.y + dy));
      pixelEditorSelection = { x: newX, y: newY, w: orig.w, h: orig.h };
      pixelEditorEditCtx.putImageData(pixelEditorSelectionBaseSnapshot, 0, 0);
      pixelEditorEditCtx.drawImage(pixelEditorSelectionFloatCanvas, newX, newY);
      renderPixelEditorView();
      return;
    }

    if (pixelEditorSelectionDragMode.startsWith("resize-")) {
      const handle = pixelEditorSelectionDragMode.slice(7);
      const dx = coordsClamped.px - pixelEditorSelectionDragStart.px;
      const dy = coordsClamped.py - pixelEditorSelectionDragStart.py;
      const orig = pixelEditorSelectionDragOrigSel;
      let { x, y, w, h } = orig;
      const origRight = x + w;
      const origBottom = y + h;

      if (handle.includes("w")) {
        const newX = Math.max(0, Math.min(origRight - 1, orig.x + dx));
        x = newX;
        w = origRight - newX;
      }
      if (handle.includes("e")) {
        w = Math.max(1, Math.min(PIXEL_EDITOR_TILE_SIZE - orig.x, orig.w + dx));
      }
      if (handle.includes("n")) {
        const newY = Math.max(0, Math.min(origBottom - 1, orig.y + dy));
        y = newY;
        h = origBottom - newY;
      }
      if (handle.includes("s")) {
        h = Math.max(1, Math.min(PIXEL_EDITOR_TILE_SIZE - orig.y, orig.h + dy));
      }

      pixelEditorSelection = { x, y, w, h };
      renderPixelEditorView();
      return;
    }

    return;
  }

  if (!pixelEditorIsPainting) {
    return;
  }

  const coords = getPixelEditorCoords(event);
  if (!coords) {
    return;
  }

  if (
    isPixelEditorShapeTool() &&
    pixelEditorShapeStart &&
    pixelEditorShapeSnapshot
  ) {
    pixelEditorEditCtx.putImageData(pixelEditorShapeSnapshot, 0, 0);
    drawActiveShape(pixelEditorShapeStart, coords);
    return;
  }

  paintPixelEditorPixel(coords.px, coords.py);
}

function onPixelEditorPaintEnd(event) {
  if (pixelEditorActiveTool === "select") {
    if (pixelEditorSelectionDragMode === "new") {
      const coordsClamped = event ? getPixelEditorCoordsClamped(event) : null;
      const noMovement = !coordsClamped ||
        (coordsClamped.px === pixelEditorSelectionDragStart.px &&
         coordsClamped.py === pixelEditorSelectionDragStart.py);
      if (noMovement) {
        // Click without drag: clear any float and deselect.
        if (pixelEditorSelectionFloatCanvas) {
          commitSelectionFloat();
        }
        pixelEditorSelection = null;
        renderPixelEditorView();
      }
      // else: selection was finalized in onPixelEditorMouseMove; nothing extra to do.
    } else if (pixelEditorSelectionDragMode === "move") {
      commitSelectionFloat();
      renderPixelEditorView();
    }
    // resize: selection already updated in mousemove; nothing extra needed.
    pixelEditorSelectionDragMode = null;
    pixelEditorSelectionDragStart = null;
    pixelEditorSelectionDragOrigSel = null;
    return;
  }

  if (
    pixelEditorIsPainting &&
    isPixelEditorShapeTool() &&
    pixelEditorShapeStart &&
    pixelEditorShapeSnapshot
  ) {
    const coords = event ? getPixelEditorCoords(event) : null;
    pixelEditorEditCtx.putImageData(pixelEditorShapeSnapshot, 0, 0);
    if (coords) {
      drawActiveShape(pixelEditorShapeStart, coords);
    } else {
      renderPixelEditorView();
    }
    pixelEditorShapeStart = null;
    pixelEditorShapeSnapshot = null;
  }

  pixelEditorIsPainting = false;
}

function onPixelEditorCustomColorChange() {
  setPixelEditorColor(pixelEditorCustomColorEl.value);
}

function onPaste(event) {
  if (!pixelEditorEditCtx) {
    return;
  }

  const items = event.clipboardData?.items;
  if (!items) {
    return;
  }

  for (const item of items) {
    if (item.type.startsWith("image/")) {
      event.preventDefault();
      const file = item.getAsFile();
      if (!file) {
        break;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (pixelEditorSelection) {
          const { x, y, w, h } = pixelEditorSelection;
          pixelEditorEditCtx.drawImage(img, x, y, w, h);
        } else {
          pixelEditorEditCtx.clearRect(0, 0, PIXEL_EDITOR_TILE_SIZE, PIXEL_EDITOR_TILE_SIZE);
          pixelEditorEditCtx.drawImage(img, 0, 0, PIXEL_EDITOR_TILE_SIZE, PIXEL_EDITOR_TILE_SIZE);
        }
        URL.revokeObjectURL(url);
        renderPixelEditorView();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
      };
      img.src = url;
      break;
    }
  }
}

function setPixelEditorColor(color) {
  pixelEditorSelectedColor = color;
  const isTransparent = color === "transparent";
  if (isTransparent) {
    pixelEditorCurrentColorEl.style.background = "";
    pixelEditorCurrentColorEl.style.backgroundImage =
      "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)";
    pixelEditorCurrentColorEl.style.backgroundSize = "10px 10px";
    pixelEditorCurrentColorEl.style.backgroundPosition = "0 0,0 5px,5px -5px,-5px 0";
    pixelEditorCurrentColorEl.style.backgroundColor = "#fff";
  } else {
    pixelEditorCurrentColorEl.style.backgroundImage = "";
    pixelEditorCurrentColorEl.style.backgroundColor = color;
  }

  const swatches = pixelEditorPaletteEl.querySelectorAll(".palette-color");
  for (const swatch of swatches) {
    swatch.classList.toggle("is-selected", swatch.dataset.color === color);
  }
}

function initPixelEditorPalette() {
  for (const color of PIXEL_EDITOR_PALETTE_COLORS) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "palette-color";
    swatch.dataset.color = color;
    swatch.title = color;
    if (color === "transparent") {
      swatch.classList.add("transparent-swatch");
    } else {
      swatch.style.backgroundColor = color;
    }
    swatch.addEventListener("click", () => {
      setPixelEditorColor(color);
    });
    pixelEditorPaletteEl.appendChild(swatch);
  }

  setPixelEditorColor(pixelEditorSelectedColor);
}

function updateToolPreviews() {
  const toolButtons = toolsEl.querySelectorAll("button[data-tool]");
  for (const button of toolButtons) {
    const previewCanvas = button.querySelector(".tool-preview");
    if (!previewCanvas) {
      continue;
    }

    const previewCtx = previewCanvas.getContext("2d");
    const toolName = button.dataset.tool;

    if (toolName === "erase") {
      previewCtx.clearRect(0, 0, 32, 32);
      previewCtx.fillStyle = "#f7f7f7";
      previewCtx.fillRect(0, 0, 32, 32);
      previewCtx.strokeStyle = "#aaa";
      previewCtx.lineWidth = 2.5;
      previewCtx.lineCap = "round";
      previewCtx.beginPath();
      previewCtx.moveTo(8, 8);
      previewCtx.lineTo(24, 24);
      previewCtx.stroke();
      previewCtx.beginPath();
      previewCtx.moveTo(24, 8);
      previewCtx.lineTo(8, 24);
      previewCtx.stroke();
      continue;
    }

    const tileType = TOOL_TILE_TYPE_MAP[toolName];
    if (!tileType) {
      continue;
    }

    const customCanvas = customTileCanvases.get(tileType);
    if (customCanvas) {
      previewCtx.clearRect(0, 0, 32, 32);
      previewCtx.drawImage(customCanvas, 0, 0, 32, 32);
      continue;
    }

    const tileObject = getTileObject(tileType);
    const mockTile = { type: tileType, water: WATER_MAX };
    previewCtx.clearRect(0, 0, 32, 32);
    tileObject.draw({ ctx: previewCtx, tile: mockTile, px: 0, py: 0, tileSize: 32 });
  }
}

function scheduleToolPreviewsOnImageLoad() {
  const imageUrls = ["images/brick.png", "images/diamond.png"];
  for (const url of imageUrls) {
    const img = new Image();
    img.src = url;
    if (img.complete) {
      updateToolPreviews();
    } else {
      img.onload = () => updateToolPreviews();
    }
  }
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
  if (hasTouchInput()) {
    touchControlsEl.classList.remove("hidden");
  }
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
  touchControlsEl.classList.add("hidden");
  updateHud();
}

function onGitHubAuthClick() {
  if (isGitHubAuthLoading || isGitHubAuthSession(gameContext.githubAuth)) {
    return;
  }

  if (!githubClientId) {
    window.alert(githubAuthUnavailableMessage);
    return;
  }

  // Delegate authentication to the portal, which handles the full OAuth flow
  // and stores a domain-wide JWT that both the portal and this page can use.
  const returnTo = encodeURIComponent(window.location.href);
  window.location.assign(portalUrl + "?returnTo=" + returnTo);
}

async function onSaveMapClick() {
  if (!isGitHubAuthSession(gameContext.githubAuth)) {
    return;
  }

  const name = window.prompt("Enter a name for this map:");
  if (!name || !name.trim()) {
    return;
  }

  saveMapBtn.disabled = true;
  saveMapBtn.textContent = "Saving…";

  try {
    const data = serializeWorldMap();
    const response = await fetch("/api/artifacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${gameContext.githubAuth.tokenType} ${gameContext.githubAuth.accessToken}`,
      },
      body: JSON.stringify({ name: name.trim(), type: "map", data }),
    });

    if (response.ok) {
      if (githubAuthStatusEl) {
        githubAuthStatusEl.textContent = `Map "${name.trim()}" saved successfully.`;
      }
    } else {
      const err = await response.json().catch(() => ({}));
      const reason = err.error || `HTTP ${response.status}`;
      if (githubAuthStatusEl) {
        githubAuthStatusEl.textContent = `Save failed: ${reason}`;
      }
    }
  } catch (error) {
    if (githubAuthStatusEl) {
      githubAuthStatusEl.textContent = `Save failed: ${error.message || "network error"}`;
    }
  } finally {
    saveMapBtn.disabled = false;
    saveMapBtn.textContent = "💾 Save Map";
  }
}

function serializeWorldMap() {
  const tiles = world.map((row) =>
    row.map(({ transDx, transDy, transProgress, ...rest }) => rest),
  );
  return { cols: COLS, rows: ROWS, tiles };
}

function cloneWorld(src) {
  return src.map((row) => row.map((tile) => ({ ...tile })));
}

function updateHud() {
}

async function initializeGitHubAuth() {
  restoreGitHubAuthFromSession();

  const callbackParams = parseGitHubCallbackParams(window.location.search);
  if (!callbackParams) {
    refreshGitHubAuthUi();
    return;
  }
  const callbackDiagnostics = formatGitHubCallbackDiagnostics(callbackParams);
  console.info(callbackDiagnostics);

  clearAuthCallbackQueryString();

  if (callbackParams.error) {
    clearPendingGitHubAuth();
    const reason = callbackParams.errorDescription || callbackParams.error;
    refreshGitHubAuthUi(`${callbackDiagnostics} GitHub auth failed: ${reason}`);
    return;
  }

  if (!callbackParams.code) {
    clearPendingGitHubAuth();
    refreshGitHubAuthUi(`${callbackDiagnostics} GitHub auth failed: missing authorization code.`);
    return;
  }

  const pending = readPendingGitHubAuth();
  if (!pending || pending.state !== callbackParams.state) {
    clearPendingGitHubAuth();
    refreshGitHubAuthUi(`${callbackDiagnostics} GitHub auth failed: invalid login state.`);
    return;
  }

  if (!githubClientId) {
    clearPendingGitHubAuth();
    refreshGitHubAuthUi(`${callbackDiagnostics} GitHub auth is not configured.`);
    return;
  }

  let failureMessage = "";
  isGitHubAuthLoading = true;
  refreshGitHubAuthUi(`${callbackDiagnostics} Completing GitHub login…`);
  try {
    const token = await exchangeGitHubCodeForToken({
      code: callbackParams.code,
      redirectUri: pending.redirectUri,
      state: pending.state,
      codeVerifier: pending.codeVerifier,
    });
    const githubUser = await fetchGitHubUser(token.accessToken, token.tokenType);
    gameContext.githubAuth = {
      ...token,
      user: githubUser,
      authenticatedAt: Date.now(),
    };
    sessionStorage.setItem(GITHUB_AUTH_STORAGE_KEY, JSON.stringify(gameContext.githubAuth));
    refreshGitHubAuthUi();
  } catch (error) {
    console.error("GitHub auth callback failed:", error);
    gameContext.githubAuth = null;
    sessionStorage.removeItem(GITHUB_AUTH_STORAGE_KEY);
    const tokenExchangeError = formatGitHubTokenExchangeError(error, { proxyUrl: githubTokenExchangeUrl });
    failureMessage = `${callbackDiagnostics} GitHub auth failed while exchanging token: ${tokenExchangeError}.`;
    refreshGitHubAuthUi(failureMessage);
  } finally {
    clearPendingGitHubAuth();
    isGitHubAuthLoading = false;
    refreshGitHubAuthUi(failureMessage);
  }
}

function restoreGitHubAuthFromSession() {
  const raw = sessionStorage.getItem(GITHUB_AUTH_STORAGE_KEY);
  if (!raw) {
    // Fall back to the portal token stored in localStorage (shared across the domain).
    const portalToken = localStorage.getItem(PORTAL_TOKEN_KEY);
    if (portalToken) {
      try {
        const portalUserRaw = localStorage.getItem(PORTAL_USER_KEY);
        const user = portalUserRaw ? JSON.parse(portalUserRaw) : null;
        gameContext.githubAuth = {
          accessToken: portalToken,
          tokenType: "Bearer",
          scope: "",
          user,
          authenticatedAt: Date.now(),
        };
        return;
      } catch {
        // ignore corrupt user data and fall through to null
      }
    }
    gameContext.githubAuth = null;
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (isGitHubAuthSession(parsed)) {
      gameContext.githubAuth = parsed;
      return;
    }
    sessionStorage.removeItem(GITHUB_AUTH_STORAGE_KEY);
    gameContext.githubAuth = null;
  } catch {
    sessionStorage.removeItem(GITHUB_AUTH_STORAGE_KEY);
    gameContext.githubAuth = null;
  }
}

function readPendingGitHubAuth() {
  const raw = sessionStorage.getItem(GITHUB_AUTH_PENDING_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(GITHUB_AUTH_PENDING_KEY);
    return null;
  }
}

function clearPendingGitHubAuth() {
  sessionStorage.removeItem(GITHUB_AUTH_PENDING_KEY);
}

function clearAuthCallbackQueryString() {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  const cleaned = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, document.title, cleaned);
}

async function beginGitHubAuth() {
  isGitHubAuthLoading = true;
  refreshGitHubAuthUi("Redirecting to GitHub…");

  const codeVerifier = createPkceVerifier();
  const codeChallenge = await createPkceChallenge(codeVerifier);
  const state = createPkceVerifier(40);
  const redirectUri = buildOAuthRedirectUri(window.location);
  sessionStorage.setItem(GITHUB_AUTH_PENDING_KEY, JSON.stringify({
    state,
    codeVerifier,
    redirectUri,
  }));

  const authUrl = buildGitHubAuthorizeUrl({
    clientId: githubClientId,
    redirectUri,
    state,
    codeChallenge,
  });
  window.location.assign(authUrl);
}

async function exchangeGitHubCodeForToken({
  code,
  redirectUri,
  state,
  codeVerifier,
}) {
  const requestBody = new URLSearchParams({
    client_id: githubClientId,
    code,
    redirect_uri: redirectUri,
    state,
    code_verifier: codeVerifier,
  });
  // When a proxy URL is configured, use it exclusively — falling back to the direct
  // GitHub endpoint is not useful because browsers always block that with CORS.
  const tokenExchangeUrl = githubTokenExchangeUrl || GITHUB_OAUTH_TOKEN_ENDPOINT;

  console.info(`Attempting GitHub token exchange via ${tokenExchangeUrl}.`);
  const response = await fetch(tokenExchangeUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: requestBody.toString(),
  });

  const responseText = await response.text();

  if (!response.ok) {
    const errorData = parseGitHubTokenEndpointResponse(responseText);
    const reason = errorData?.error_description
      || errorData?.error
      || summarizeGitHubTokenErrorBody(responseText)
      || "unknown error";
    throw new Error(`GitHub token endpoint failed (${response.status}): ${reason}`);
  }

  const data = parseGitHubTokenEndpointResponse(responseText, { warnOnParseError: true }) || {};
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  if (!data.access_token) {
    throw new Error("GitHub response did not include an access token.");
  }

  return {
    accessToken: data.access_token,
    tokenType: normalizeAuthTokenType(data.token_type || "bearer"),
    scope: data.scope || "",
  };
}

async function fetchGitHubUser(accessToken, tokenType) {
  const authTokenType = normalizeAuthTokenType(tokenType);
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `${authTokenType} ${accessToken}`,
    },
  });
  if (!response.ok) {
    console.warn(`GitHub user fetch failed with status ${response.status}.`);
    return null;
  }
  return response.json();
}

function normalizeAuthTokenType(tokenType) {
  if (typeof tokenType === "string" && tokenType.toLowerCase() === "bearer") {
    return "Bearer";
  }
  return tokenType;
}

function summarizeGitHubTokenErrorBody(responseText) {
  if (typeof responseText !== "string") {
    return "";
  }
  const normalized = responseText.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  const truncated = normalized.length <= GITHUB_TOKEN_ERROR_SUMMARY_MAX_LENGTH
    ? normalized
    : `${normalized.slice(0, GITHUB_TOKEN_ERROR_SUMMARY_MAX_LENGTH - 3)}...`;
  return escapeHtmlEntities(truncated);
}

function escapeHtmlEntities(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function refreshGitHubAuthUi(errorMessage = "") {
  const hasGitHubAuthSession = isGitHubAuthSession(gameContext.githubAuth);
  githubAuthBtn.classList.toggle("hidden", hasGitHubAuthSession && !isGitHubAuthLoading);
  saveMapBtn.classList.toggle("hidden", !hasGitHubAuthSession || isGitHubAuthLoading);

  if (isGitHubAuthLoading) {
    githubAuthBtn.textContent = "Authenticating…";
    githubAuthBtn.disabled = true;
    if (githubAuthStatusEl) {
      githubAuthStatusEl.textContent = errorMessage || "GitHub authentication in progress.";
    }
    return;
  }

  if (hasGitHubAuthSession) {
    if (githubAuthStatusEl) {
      const username = gameContext.githubAuth.user?.login;
      githubAuthStatusEl.textContent = username
        ? `GitHub connected as @${username}.`
        : "GitHub connected.";
    }
    return;
  }

  if (!githubClientId) {
    githubAuthBtn.textContent = "GitHub Auth Unavailable";
    githubAuthBtn.disabled = true;
    if (githubAuthStatusEl) {
      githubAuthStatusEl.textContent = githubAuthUnavailableMessage;
    }
    return;
  }

  githubAuthBtn.textContent = "Authenticate with GitHub";
  githubAuthBtn.disabled = false;
  if (githubAuthStatusEl) {
    githubAuthStatusEl.textContent = errorMessage || "GitHub: Not connected.";
  }
}

function hasTouchInput() {
  return navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
}

function onTouchControlPointerDown(event) {
  const btn = event.target.closest("[data-touch-action]");
  if (!btn) {
    return;
  }
  event.preventDefault();
  const action = btn.dataset.touchAction;
  if (action === "up") {
    if (appMode === "play" && gameState === "playing") tryMove(0, -1);
  } else if (action === "down") {
    if (appMode === "play" && gameState === "playing") tryMove(0, 1);
  } else if (action === "left") {
    if (appMode === "play" && gameState === "playing") tryMove(-1, 0);
  } else if (action === "right") {
    if (appMode === "play" && gameState === "playing") tryMove(1, 0);
  } else if (action === "dig") {
    if (appMode === "play" && gameState === "playing") breakSoil();
  } else if (action === "pour") {
    if (appMode === "play" && gameState === "playing") pourWaterForward();
  } else if (action === "reset") {
    resetGame();
  }
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  const isMoveKey = MOVE_KEYS.includes(key);
  const isActionKey = ACTION_KEYS.includes(key);

  if (appMode === "play" && (isMoveKey || isActionKey)) {
    event.preventDefault();
  }

  // Pixel editor keyboard shortcuts.
  if (pixelEditorEditCtx && (event.ctrlKey || event.metaKey)) {
    if (key === "c" && pixelEditorActiveTool === "select" && pixelEditorSelection) {
      event.preventDefault();
      copySelectionToClipboard();
      return;
    }
    if (key === "x" && pixelEditorActiveTool === "select" && pixelEditorSelection) {
      event.preventDefault();
      cutSelection();
      return;
    }
    if (key === "v" && pixelEditorSelectionClipboard) {
      event.preventDefault();
      pasteFromInternalClipboard();
      return;
    }
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
    applyTileTransition(world[ny][pushX], nx, ny, pushX, ny);
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
  const transitioningTiles = collectTransitioningTiles(world, TileType.EMPTY);
  const transitioningKeys = new Set(transitioningTiles.map(({ x, y }) => `${x},${y}`));

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (transitioningKeys.has(`${x},${y}`)) {
        drawTile(x, y, { type: TileType.EMPTY }, false);
        continue;
      }
      drawTile(x, y, world[y][x], false);
    }
  }

  for (const { x, y, tile } of transitioningTiles) {
    drawTile(x, y, tile, true);
  }

  drawPlayer();
  drawGrid();
}

function drawTile(x, y, tile, applyTransition = true) {
  const transition = applyTransition ? getTileTransitionOffset(tile) : { x: 0, y: 0 };
  const px = x * TILE_SIZE + transition.x;
  const py = y * TILE_SIZE + transition.y;

  const customCanvas = customTileCanvases.get(tile.type);
  if (customCanvas) {
    ctx.drawImage(customCanvas, px, py, TILE_SIZE, TILE_SIZE);
    return;
  }

  const tileObject = getTileObject(tile.type);
  tileObject.draw({
    ctx,
    tile,
    px,
    py,
    tileSize: TILE_SIZE,
  });
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

function stepObjectTransitions() {
  for (const row of world) {
    for (const tile of row) {
      if (typeof tile.transProgress !== "number" || tile.transProgress <= 0) {
        continue;
      }

      const step = 1 / getTransitionFrames(tile.type);
      tile.transProgress = Math.max(0, tile.transProgress - step);
      if (tile.transProgress > 0) {
        continue;
      }

      delete tile.transDx;
      delete tile.transDy;
      delete tile.transProgress;
    }
  }
}

function getTransitionFrames(type) {
  const baseFrames = OBJECT_TRANSITION_FRAMES[type] || DEFAULT_TRANSITION_FRAMES;
  return Math.max(1, Math.round(baseFrames * tickIntervalMultiplier));
}

function getRockStepFrames() {
  return Math.max(1, Math.round(ROCK_STEP_FRAMES_1X * tickIntervalMultiplier));
}

function getMonsterStepFrames() {
  return Math.max(1, Math.round(MONSTER_STEP_FRAMES_1X * tickIntervalMultiplier));
}

function getTileTransitionOffset(tile) {
  if (typeof tile.transProgress !== "number" || tile.transProgress <= 0) {
    return { x: 0, y: 0 };
  }
  const transDx = Number.isFinite(tile.transDx) ? tile.transDx : 0;
  const transDy = Number.isFinite(tile.transDy) ? tile.transDy : 0;
  return {
    x: transDx * TILE_SIZE * tile.transProgress,
    y: transDy * TILE_SIZE * tile.transProgress,
  };
}

function applyTileTransition(tile, fromX, fromY, toX, toY) {
  tile.transDx = fromX - toX;
  tile.transDy = fromY - toY;
  tile.transProgress = 1;
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
