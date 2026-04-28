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

## Backend deployment configuration

The backend acts as a proxy for GitHub OAuth token exchange (browsers cannot call `github.com/login/oauth/access_token` directly due to CORS). The deployment serves the game's static files **and** the API from the same domain via Caddy, so the `github-token-exchange-url` relative path in `index.html` always resolves correctly.

Before running `deploy/deploy.sh` you must create a `deploy/.env` file with all required values.

### 1. Create the `.env` file

```bash
cp deploy/.env.example deploy/.env
```

Then fill in each variable as described below.

### 2. Required variables

| Variable | Description |
|---|---|
| `GH_CLIENT_ID` | Client ID of your GitHub OAuth App (see below). |
| `GH_CLIENT_SECRET` | Client Secret of your GitHub OAuth App (see below). |
| `JWT_SECRET` | A random 32-byte hex string used to sign JWTs. Generate with `openssl rand -hex 32`. **Treat this like a password — never share it.** |
| `DOMAIN` | Public hostname of your server (e.g. `game.example.com`). Caddy uses this to obtain a TLS certificate automatically. Both the game and the API will be served from this domain. |

### 3. Create a GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
   (direct link: <https://github.com/settings/applications/new>).
2. Fill in the form:
   - **Application name** — any name, e.g. `vibe-game-tool`
   - **Homepage URL** — your server URL, e.g. `https://game.example.com`
   - **Authorization callback URL** — the page that completes the login flow, e.g.
     `https://game.example.com` (must match the URL where the game is hosted)
3. Click **Register application**.
4. Copy the **Client ID** → set as `GH_CLIENT_ID` in `deploy/.env`.
5. Click **Generate a new client secret**, copy the value → set as `GH_CLIENT_SECRET` in `deploy/.env`.

### 4. Update `index.html` with your Client ID

Set the `github-client-id` meta tag in `index.html` to your OAuth App's Client ID:

```html
<meta name="github-client-id" content="Ov23liABCDEFGHIJKLMN">
```

The `github-token-exchange-url` is already set to the correct relative path (`/api/github/oauth/access_token`) and does not need to be changed for the self-hosted deployment.

### 5. Generate `JWT_SECRET`

```bash
openssl rand -hex 32
```

Paste the output as the value of `JWT_SECRET` in `deploy/.env`.

### 6. Run the deployment script

```bash
sudo bash deploy/deploy.sh
```

The script installs Docker, clones/updates the repository on the server, validates `deploy/.env`, and starts the Docker Compose stack. Caddy serves the game's static files at `https://DOMAIN/` and proxies all `/api/*` requests to the backend.
