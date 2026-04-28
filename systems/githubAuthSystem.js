const PKCE_VERIFIER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
const DEFAULT_SCOPE = "read:user";
const GITHUB_TOKEN_RESPONSE_FIELDS = ["access_token", "token_type", "scope", "error", "error_description"];

export const GITHUB_AUTH_STORAGE_KEY = "vibeGame.githubAuth";
export const GITHUB_AUTH_PENDING_KEY = "vibeGame.githubAuth.pending";

function normalizeConfigValue(value) {
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

export function formatGitHubCallbackDiagnostics(callbackParams) {
  if (!callbackParams) {
    return "GitHub callback not detected.";
  }
  const hasCode = typeof callbackParams.code === "string" && callbackParams.code.length > 0;
  const hasState = typeof callbackParams.state === "string" && callbackParams.state.length > 0;
  const error = callbackParams.error || "none";
  return `GitHub callback received (code: ${hasCode ? "yes" : "no"}, state: ${hasState ? "yes" : "no"}, error: ${error}).`;
}

export function formatGitHubTokenExchangeError(error, { proxyUrl } = {}) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (!message) {
    return "unknown error";
  }
  if (message === "Failed to fetch") {
    if (proxyUrl) {
      return `network request to ${proxyUrl} failed (proxy endpoint unreachable or misconfigured)`;
    }
    return "network request failed (possible CORS restriction or blocked token endpoint). Configure a same-origin proxy endpoint to avoid browser CORS restrictions (see README).";
  }
  return message;
}

export function parseGitHubTokenEndpointResponse(responseText, options = {}) {
  if (!responseText) {
    return {};
  }
  try {
    return JSON.parse(responseText);
  } catch {
    const params = new URLSearchParams(responseText);
    const hasKnownTokenField = GITHUB_TOKEN_RESPONSE_FIELDS.some((key) => params.has(key));
    if (hasKnownTokenField) {
      const data = {};
      for (const key of GITHUB_TOKEN_RESPONSE_FIELDS) {
        if (params.has(key)) {
          data[key] = params.get(key);
        }
      }
      return data;
    }
    if (options.warnOnParseError) {
      console.warn("GitHub token endpoint returned non-JSON response.");
    }
    return {};
  }
}

export function resolveGitHubClientId(metaClientId, windowClientId) {
  return normalizeConfigValue(metaClientId) || normalizeConfigValue(windowClientId);
}

export function resolveGitHubTokenExchangeUrl(metaTokenExchangeUrl, windowTokenExchangeUrl) {
  return normalizeConfigValue(metaTokenExchangeUrl) || normalizeConfigValue(windowTokenExchangeUrl);
}

export function isGitHubAuthSession(auth) {
  return Boolean(
    auth
    && typeof auth === "object"
    && typeof auth.accessToken === "string"
    && auth.accessToken.length > 0,
  );
}

export function getGitHubAuthUnavailableMessage() {
  return "GitHub auth unavailable: missing GitHub OAuth client ID. Set the github-client-id meta tag or window.VIBE_GITHUB_CLIENT_ID.";
}
