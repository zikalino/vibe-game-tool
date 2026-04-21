# vibe-game-tool
Vibe Game Tool

[▶ Play the game](https://zikalino.github.io/vibe-game-tool)

## GitHub authentication setup

If the game shows **GitHub Auth Unavailable**, the GitHub OAuth client ID is not configured.
Set either:

- `<meta name="github-client-id" content="YOUR_CLIENT_ID">` in `index.html`, or
- `window.VIBE_GITHUB_CLIENT_ID = "YOUR_CLIENT_ID"` before `game.js` loads.

If your browser blocks direct token exchange to `https://github.com/login/oauth/access_token`, configure a same-origin token exchange endpoint that proxies this request server-side:

- `<meta name="github-token-exchange-url" content="/api/github/oauth/access_token">` in `index.html`, or
- `window.VIBE_GITHUB_TOKEN_EXCHANGE_URL = "/api/github/oauth/access_token"` before `game.js` loads.
