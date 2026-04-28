import { Router } from "express";

const router = Router();

const GH_CLIENT_ID = process.env.GH_CLIENT_ID || "";

/**
 * GET /portal
 * Serves the browser-based user portal. Handles GitHub OAuth callback and
 * displays the authenticated user's artifact list.
 */
router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(buildPortalHtml(GH_CLIENT_ID));
});

function buildPortalHtml(clientId) {
  // Safely embed the client ID as a JS string literal.
  const clientIdJson = JSON.stringify(clientId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vibe Game Tool – My Artifacts</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      min-height: 100vh;
    }
    header {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    header h1 { font-size: 1.1rem; font-weight: 600; }
    .user-bar { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; }
    .user-bar img { width: 28px; height: 28px; border-radius: 50%; }
    main { max-width: 900px; margin: 40px auto; padding: 0 20px; }
    .login-card {
      text-align: center;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 48px 32px;
      max-width: 420px;
      margin: 0 auto;
    }
    .login-card h2 { margin-bottom: 12px; }
    .login-card p { color: #8b949e; margin-bottom: 24px; font-size: 0.95rem; }
    button {
      background: #238636;
      color: #fff;
      border: none;
      padding: 8px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
    }
    button:hover { background: #2ea043; }
    button.danger { background: #b62324; }
    button.danger:hover { background: #d1242f; }
    button.secondary { background: #21262d; border: 1px solid #30363d; color: #e6edf3; }
    button.secondary:hover { background: #30363d; }
    section { margin-bottom: 36px; }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #30363d;
    }
    .section-header h2 { font-size: 1rem; font-weight: 600; }
    .artifact-list { list-style: none; }
    .artifact-list li {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .artifact-info { flex: 1; min-width: 0; }
    .artifact-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .artifact-meta { font-size: 0.78rem; color: #8b949e; margin-top: 3px; }
    .badge {
      flex-shrink: 0;
      font-size: 0.72rem;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 12px;
      background: #1f6feb33;
      color: #58a6ff;
      border: 1px solid #1f6feb66;
    }
    .badge.tile { background: #3fb95033; color: #56d364; border-color: #3fb95066; }
    .empty { color: #8b949e; font-style: italic; padding: 12px 0; }
    #status { text-align: center; color: #8b949e; padding: 60px 20px; }
    #error-msg { color: #f85149; text-align: center; padding: 20px; }
  </style>
</head>
<body>
  <header>
    <h1>Vibe Game Tool</h1>
    <div id="user-bar"></div>
  </header>
  <main id="main">
    <div id="status">Loading…</div>
  </main>

  <script>
    const GH_CLIENT_ID = ${clientIdJson};

    // ── PKCE helpers ──────────────────────────────────────────────────────────
    const PKCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

    function createVerifier(len = 96) {
      const bytes = crypto.getRandomValues(new Uint8Array(len));
      return Array.from(bytes, b => PKCE_CHARS[b % PKCE_CHARS.length]).join('');
    }

    async function createChallenge(verifier) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    }

    // ── Auth state ────────────────────────────────────────────────────────────
    const TOKEN_KEY = 'vgPortal.token';
    let token = localStorage.getItem(TOKEN_KEY);

    async function startLogin() {
      if (!GH_CLIENT_ID) {
        showError('GitHub Client ID is not configured on this server.');
        return;
      }
      const verifier = createVerifier();
      const challenge = await createChallenge(verifier);
      const state = createVerifier(40);
      const redirectUri = window.location.origin + window.location.pathname;
      sessionStorage.setItem('vgPortal.pending', JSON.stringify({ state, verifier, redirectUri }));
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', GH_CLIENT_ID);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      window.location.assign(url.toString());
    }

    function logout() {
      localStorage.removeItem(TOKEN_KEY);
      token = null;
      render();
    }

    async function handleCallback() {
      const sp = new URLSearchParams(window.location.search);
      const code = sp.get('code');
      if (!code) return;
      const pending = JSON.parse(sessionStorage.getItem('vgPortal.pending') || 'null');
      sessionStorage.removeItem('vgPortal.pending');
      if (!pending || pending.state !== sp.get('state')) {
        console.error('OAuth state mismatch – ignoring callback');
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
      window.history.replaceState({}, '', window.location.pathname);
      const r = await fetch('/api/auth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: pending.verifier }),
      });
      const d = await r.json();
      if (d.token) {
        token = d.token;
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        showError('Authentication failed: ' + (d.error || 'unknown error'));
      }
    }

    async function apiGet(path) {
      const r = await fetch(path, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (r.status === 401) { logout(); return null; }
      if (!r.ok) return null;
      return r.json();
    }

    async function apiDelete(path) {
      const r = await fetch(path, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (r.status === 401) { logout(); return null; }
      return r.ok;
    }

    // ── Rendering ─────────────────────────────────────────────────────────────
    function esc(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function fmtDate(iso) {
      // SQLite stores UTC without the trailing Z
      return new Date(iso.endsWith('Z') ? iso : iso + 'Z').toLocaleString();
    }

    function renderList(artifacts) {
      if (!artifacts.length) return '<p class="empty">No artifacts yet.</p>';
      return '<ul class="artifact-list">' +
        artifacts.map(a =>
          '<li>' +
            '<div class="artifact-info">' +
              '<div class="artifact-name">' + esc(a.name) + '</div>' +
              '<div class="artifact-meta">Updated ' + fmtDate(a.updated_at) + '</div>' +
            '</div>' +
            '<span class="badge ' + esc(a.type) + '">' + esc(a.type) + '</span>' +
            '<button class="danger" onclick="deleteArtifact(' + a.id + ')">Delete</button>' +
          '</li>'
        ).join('') +
      '</ul>';
    }

    function showError(msg) {
      document.getElementById('main').innerHTML =
        '<div id="error-msg">' + esc(msg) + '</div>';
    }

    async function deleteArtifact(id) {
      if (!confirm('Delete this artifact?')) return;
      const ok = await apiDelete('/api/artifacts/' + id);
      if (ok) render();
    }

    async function render() {
      const main = document.getElementById('main');
      const bar  = document.getElementById('user-bar');

      if (!token) {
        bar.innerHTML = '';
        main.innerHTML =
          '<div class="login-card">' +
            '<h2>My Artifacts</h2>' +
            '<p>Sign in with GitHub to view and manage your map and tile artifacts.</p>' +
            '<button onclick="startLogin()">Login with GitHub</button>' +
          '</div>';
        return;
      }

      const [user, artifacts] = await Promise.all([
        apiGet('/api/me'),
        apiGet('/api/artifacts'),
      ]);
      if (!user || !artifacts) return;

      bar.innerHTML =
        '<div class="user-bar">' +
          '<img src="' + esc(user.avatar_url) + '" alt="' + esc(user.login) + '" />' +
          '<span>' + esc(user.login) + '</span>' +
          '<button class="secondary" onclick="logout()">Logout</button>' +
        '</div>';

      const maps  = artifacts.filter(a => a.type === 'map');
      const tiles = artifacts.filter(a => a.type === 'tile');

      main.innerHTML =
        '<section>' +
          '<div class="section-header"><h2>Maps (' + maps.length + ')</h2></div>' +
          renderList(maps) +
        '</section>' +
        '<section>' +
          '<div class="section-header"><h2>Tiles (' + tiles.length + ')</h2></div>' +
          renderList(tiles) +
        '</section>';
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    (async () => {
      if (new URLSearchParams(window.location.search).has('code')) {
        await handleCallback();
      }
      await render();
    })();
  </script>
</body>
</html>`;
}

export default router;
