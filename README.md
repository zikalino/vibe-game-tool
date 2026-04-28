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

## GitHub Actions deployment

The `Deploy Backend to Ubuntu VM` workflow (`deploy-backend.yml`) deploys the stack to an UpCloud (or any Ubuntu) VM via SSH.

### Required secrets

| Secret | Description |
|---|---|
| `DEPLOY_SSH_KEY` | Private SSH key with root access to the VM. |
| `GH_CLIENT_ID` | GitHub OAuth App Client ID. |
| `GH_CLIENT_SECRET` | GitHub OAuth App Client Secret. |
| `JWT_SECRET` | 32-byte hex JWT signing secret. |
| `DOMAIN` | Public hostname or IP of the VM (written to `deploy/.env` and used by Caddy). |

### Optional secrets

| Secret | Description |
|---|---|
| `VM_HOST` | IP address or hostname used **only** for the SSH connection.  Set this when `DOMAIN` is a proper hostname that is not yet resolvable from the GitHub Actions runner (e.g. during initial setup).  Falls back to `DOMAIN` when not set. |



When the game is served from GitHub Pages **and** the backend runs on a separate server, you must tell the frontend where to reach the backend for OAuth token exchange. GitHub Pages only serves static files; it returns **405 Method Not Allowed** for any POST request, so the default relative URL (`/api/github/oauth/access_token`) will not work.

Set the `BACKEND_URL` secret in your GitHub repository (**Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Value |
|---|---|
| `BACKEND_URL` | Base URL of your backend server, e.g. `https://api.example.com` |

The `Deploy to GitHub Pages` workflow automatically rewrites the `github-token-exchange-url` meta tag in `index.html` to use `${BACKEND_URL}/api/github/oauth/access_token` before publishing. The backend must have CORS enabled so the GitHub Pages origin can reach it (the included Express backend allows all origins by default).

> **Note:** Also register your GitHub Pages URL (e.g. `https://zikalino.github.io/vibe-game-tool`) as an **Authorization callback URL** in your GitHub OAuth App settings, since that is where GitHub will redirect users after they authorize. If you are also running the self-hosted backend, add its portal URL too (e.g. `https://api.example.com/portal`) — see [Create a GitHub OAuth App](#3-create-a-github-oauth-app) below.

## Backend deployment configuration

The backend acts as a proxy for GitHub OAuth token exchange (browsers cannot call `github.com/login/oauth/access_token` directly due to CORS). When using the self-hosted Docker/Caddy stack the deployment serves the game's static files **and** the API from the same domain, so the `github-token-exchange-url` relative path in `index.html` resolves correctly without any additional configuration.

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
| `DOMAIN` | Public hostname **or** IP address of your server (e.g. `game.example.com` or `203.0.113.10`). See note below about HTTP vs HTTPS. |

> **Domain vs IP address**
>
> * **Hostname** (`game.example.com`) — Caddy automatically obtains a free TLS certificate via Let's Encrypt and serves the game over **HTTPS**.  DNS for the hostname must already point to the server.
> * **Bare IP address** (`203.0.113.10`) — Caddy cannot obtain a public certificate for an IP address.  The deploy script detects this automatically and configures Caddy to serve over plain **HTTP** on port 80 instead.  Connecting to `http://203.0.113.10` in a browser will show the game.  (GitHub OAuth will still work; the callback URL just has to be `http://…` in your OAuth App settings.)
>
> When you later point a real domain at the server, update `DOMAIN` to the hostname and re-run the deploy script to upgrade to HTTPS.

### 3. Create a GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
   (direct link: <https://github.com/settings/applications/new>).
2. Fill in the form:
   - **Application name** — any name, e.g. `vibe-game-tool`
   - **Homepage URL** — your server URL, e.g. `https://game.example.com`
   - **Authorization callback URL** — add **both** of the following (one per line, or
     register them as separate OAuth Apps):
     - `https://game.example.com` — for the in-game login flow
     - `https://game.example.com/portal` — for the user artifact portal
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

The script installs Docker, clones/updates the repository on the server, validates `deploy/.env`, and starts the Docker Compose stack. Caddy serves the game's static files and proxies all `/api/*` requests to the backend.  If `DOMAIN` is a hostname the game is served at `https://DOMAIN/`; if it is a bare IP address it is served at `http://IP/` over plain HTTP.

## Artifact storage and user portal

Authenticated users can store named **map** and **tile** artifacts through the REST API, and view them in the browser-based user portal.

### User portal

Visit `https://DOMAIN/portal` in any browser. Click **Login with GitHub** to authenticate. After sign-in you will see two sections — **Maps** and **Tiles** — listing all artifacts you have stored.

> **Important:** The portal uses `https://DOMAIN/portal` as the OAuth redirect URI. This exact URL must be registered as an **Authorization callback URL** in your GitHub OAuth App settings (in addition to `https://DOMAIN` for the in-game login). If it is missing, GitHub will display a *"The redirect_uri is not associated with this application"* warning. See [Create a GitHub OAuth App](#3-create-a-github-oauth-app) for the full setup steps.

### Artifact REST API

All endpoints require a `Authorization: Bearer <jwt>` header obtained from `POST /api/auth/github`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/artifacts` | List all artifacts for the authenticated user (id, name, type, timestamps). |
| `POST` | `/api/artifacts` | Create a new artifact. Body: `{ name, type, data? }` |
| `GET` | `/api/artifacts/:id` | Fetch a single artifact including its full data payload. |
| `PUT` | `/api/artifacts/:id` | Update name and/or data of an artifact. Body: `{ name, data? }` |
| `DELETE` | `/api/artifacts/:id` | Delete an artifact. |

**`type`** must be one of `"map"` or `"tile"`. The `data` field accepts any JSON object (max 1 MB).

**Example – store a map:**

```bash
curl -X POST https://DOMAIN/api/artifacts \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"My World","type":"map","data":{"width":10,"height":10,"tiles":[]}}'
```

**Example – store a tile set:**

```bash
curl -X POST https://DOMAIN/api/artifacts \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"Grass Pack","type":"tile","data":{"frames":[]}}'
```
