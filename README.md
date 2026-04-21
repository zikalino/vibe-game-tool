# vibe-game-tool
Vibe Game Tool

[▶ Play the game](https://zikalino.github.io/vibe-game-tool)

## How objects are drawn

The game is rendered directly on the HTML5 `<canvas>` in `game.js`.

- Main render loop: `draw()` (around `game.js` line 641)
- Tile/object drawing: `drawTile(...)` (around `game.js` line 654)
- Player drawing: `drawPlayer()` (around `game.js` line 764)
- Monster drawing: `drawMonster(...)` (around `game.js` line 779)

Objects are drawn with canvas primitives (`fillRect`, `arc`, `beginPath`, etc.), not from image sprite files. That is why you do not see image assets in the project.
