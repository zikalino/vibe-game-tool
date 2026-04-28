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

The backend acts as a proxy for GitHub OAuth token exchange (browsers cannot call `github.com/login/oauth/access_token` directly due to CORS). Before running `deploy/deploy.sh` you must create a `deploy/.env` file with all required values.

### 1. Create the `.env` file

```bash
cp deploy/.env.example deploy/.env
```

Then fill in each variable as described below.

### 2. Required variables

| Variable | Description |
|---|---|
| `GITHUB_CLIENT_ID` | Client ID of your GitHub OAuth App (see below). |
| `GITHUB_CLIENT_SECRET` | Client Secret of your GitHub OAuth App (see below). |
| `JWT_SECRET` | A random 32-byte hex string used to sign JWTs. Generate with `openssl rand -hex 32`. **Treat this like a password — never share it.** |
| `DOMAIN` | Public hostname of your server (e.g. `api.example.com`). Caddy uses this to obtain a TLS certificate automatically. |

### 3. Create a GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
   (direct link: <https://github.com/settings/applications/new>).
2. Fill in the form:
   - **Application name** — any name, e.g. `vibe-game-tool`
   - **Homepage URL** — your public game URL, e.g. `https://yourname.github.io/vibe-game-tool`
   - **Authorization callback URL** — the page that completes the login flow, e.g.
     `https://yourname.github.io/vibe-game-tool` (must match the `redirect_uri` the game sends)
3. Click **Register application**.
4. Copy the **Client ID** → set as `GITHUB_CLIENT_ID` in `deploy/.env`.
5. Click **Generate a new client secret**, copy the value → set as `GITHUB_CLIENT_SECRET` in `deploy/.env`.

### 4. Generate `JWT_SECRET`

```bash
openssl rand -hex 32
```

Paste the output as the value of `JWT_SECRET` in `deploy/.env`.

### 5. Run the deployment script

```bash
sudo bash deploy/deploy.sh
```

The script installs Docker, clones/updates the repository on the server, validates `deploy/.env`, and starts the Docker Compose stack with Caddy (HTTPS) in front of the backend.
