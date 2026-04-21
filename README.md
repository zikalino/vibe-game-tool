# vibe-game-tool
Vibe Game Tool

[▶ Play the game](https://zikalino.github.io/vibe-game-tool)

## GitHub authentication setup

If the game shows **GitHub Auth Unavailable**, the GitHub OAuth client ID is not configured.
Set either:

- `<meta name="github-client-id" content="YOUR_CLIENT_ID">` in `index.html`, or
- `window.VIBE_GITHUB_CLIENT_ID = "YOUR_CLIENT_ID"` before `game.js` loads.
