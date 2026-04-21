const PKCE_VERIFIER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
const DEFAULT_SCOPE = "read:user";

export const GITHUB_AUTH_STORAGE_KEY = "vibeGame.githubAuth";
export const GITHUB_AUTH_PENDING_KEY = "vibeGame.githubAuth.pending";

function normalizeClientId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function base64UrlEncode(bytes) {
  const text = String.fromCharCode(...bytes);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomIndex(maxExclusive) {
  const unbiasedLimit = Math.floor(256 / maxExclusive) * maxExclusive;
  const randomBytes = new Uint8Array(1);
  while (true) {
    crypto.getRandomValues(randomBytes);
    if (randomBytes[0] < unbiasedLimit) {
      return randomBytes[0] % maxExclusive;
    }
  }
}

export function createPkceVerifier(length = 96) {
  let verifier = "";
  for (let i = 0; i < length; i += 1) {
    verifier += PKCE_VERIFIER_CHARS[randomIndex(PKCE_VERIFIER_CHARS.length)];
  }
  return verifier;
}

export async function createPkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export function buildGitHubAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
  scope = DEFAULT_SCOPE,
}) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function parseGitHubCallbackParams(search) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (!params.has("code") && !params.has("error")) {
    return null;
  }
  return {
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error"),
    errorDescription: params.get("error_description"),
  };
}

export function resolveGitHubClientId(metaClientId, windowClientId) {
  return normalizeClientId(metaClientId) || normalizeClientId(windowClientId);
}

export function getGitHubAuthUnavailableMessage() {
  return "GitHub auth unavailable: missing GitHub OAuth client ID. Set the github-client-id meta tag or window.VIBE_GITHUB_CLIENT_ID.";
}
