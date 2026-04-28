import test from "node:test";
import assert from "node:assert/strict";

import {
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
} from "./githubAuthSystem.js";

test("createPkceVerifier creates URL-safe PKCE verifier", () => {
  const verifier = createPkceVerifier();

  assert.equal(verifier.length, 96);
  assert.match(verifier, /^[A-Za-z0-9\-._~]+$/);
});

test("createPkceChallenge creates deterministic challenge for verifier", async () => {
  const challenge = await createPkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
  assert.equal(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("buildGitHubAuthorizeUrl includes expected OAuth parameters", () => {
  const url = new URL(buildGitHubAuthorizeUrl({
    clientId: "abc123",
    redirectUri: "https://example.com/callback",
    state: "xyz",
    codeChallenge: "challenge",
  }));

  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/login/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "abc123");
  assert.equal(url.searchParams.get("redirect_uri"), "https://example.com/callback");
  assert.equal(url.searchParams.get("scope"), "read:user");
  assert.equal(url.searchParams.get("state"), "xyz");
  assert.equal(url.searchParams.get("code_challenge"), "challenge");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
});

test("parseGitHubCallbackParams returns null when no callback data is present", () => {
  assert.equal(parseGitHubCallbackParams("?foo=bar"), null);
});

test("parseGitHubCallbackParams reads callback values", () => {
  const parsed = parseGitHubCallbackParams("?code=abc&state=xyz");
  assert.deepEqual(parsed, {
    code: "abc",
    state: "xyz",
    error: null,
    errorDescription: null,
  });
});

test("formatGitHubCallbackDiagnostics describes callback fields without exposing the code", () => {
  assert.equal(
    formatGitHubCallbackDiagnostics({ code: "secret-code", state: "state123", error: null }),
    "GitHub callback received (code: yes, state: yes, error: none).",
  );
  assert.equal(
    formatGitHubCallbackDiagnostics({ code: null, state: null, error: "access_denied" }),
    "GitHub callback received (code: no, state: no, error: access_denied).",
  );
  assert.equal(
    formatGitHubCallbackDiagnostics(null),
    "GitHub callback not detected.",
  );
});

test("resolveGitHubClientId returns first non-empty trimmed value", () => {
  assert.equal(resolveGitHubClientId("  meta-id  ", "window-id"), "meta-id");
  assert.equal(resolveGitHubClientId("   ", "  window-id  "), "window-id");
  assert.equal(resolveGitHubClientId("", ""), "");
});

test("resolveGitHubTokenExchangeUrl returns first non-empty trimmed value", () => {
  assert.equal(resolveGitHubTokenExchangeUrl("  https://example.com/token  ", "https://fallback"), "https://example.com/token");
  assert.equal(resolveGitHubTokenExchangeUrl("   ", "  https://fallback  "), "https://fallback");
  assert.equal(resolveGitHubTokenExchangeUrl("", ""), "");
});

test("formatGitHubTokenExchangeError returns readable diagnostics", () => {
  assert.equal(
    formatGitHubTokenExchangeError(new TypeError("Failed to fetch")),
    "network request failed (possible CORS restriction or blocked token endpoint). Configure a same-origin proxy endpoint to avoid browser CORS restrictions (see README).",
  );
  assert.equal(
    formatGitHubTokenExchangeError(new TypeError("Failed to fetch"), { proxyUrl: "/api/github/oauth/access_token" }),
    "network request to /api/github/oauth/access_token failed (proxy endpoint unreachable or misconfigured)",
  );
  assert.equal(
    formatGitHubTokenExchangeError(new Error("bad_verification_code")),
    "bad_verification_code",
  );
  assert.equal(
    formatGitHubTokenExchangeError({}),
    "unknown error",
  );
});

test("parseGitHubTokenEndpointResponse parses JSON token responses", () => {
  const parsed = parseGitHubTokenEndpointResponse("{\"access_token\":\"abc\",\"scope\":\"read:user\",\"token_type\":\"bearer\"}");
  assert.deepEqual(parsed, {
    access_token: "abc",
    scope: "read:user",
    token_type: "bearer",
  });
});

test("parseGitHubTokenEndpointResponse parses URL-encoded token responses", () => {
  const parsed = parseGitHubTokenEndpointResponse("access_token=abc&scope=read%3Auser&token_type=bearer");
  assert.deepEqual(parsed, {
    access_token: "abc",
    token_type: "bearer",
    scope: "read:user",
  });
});

test("isGitHubAuthSession checks required auth token shape", () => {
  assert.equal(isGitHubAuthSession({ accessToken: "token123" }), true);
  assert.equal(isGitHubAuthSession({ accessToken: "" }), false);
  assert.equal(isGitHubAuthSession({ token: "token123" }), false);
  assert.equal(isGitHubAuthSession(null), false);
  assert.equal(isGitHubAuthSession(undefined), false);
});

test("getGitHubAuthUnavailableMessage explains missing configuration", () => {
  assert.equal(
    getGitHubAuthUnavailableMessage(),
    "GitHub auth unavailable: missing GitHub OAuth client ID. Set the github-client-id meta tag or window.VIBE_GITHUB_CLIENT_ID.",
  );
});

test("buildOAuthRedirectUri omits trailing slash for root path", () => {
  assert.equal(
    buildOAuthRedirectUri({ origin: "https://smartercode.eu", pathname: "/" }),
    "https://smartercode.eu",
  );
});

test("buildOAuthRedirectUri preserves sub-path without trailing slash", () => {
  assert.equal(
    buildOAuthRedirectUri({ origin: "https://smartercode.eu", pathname: "/portal" }),
    "https://smartercode.eu/portal",
  );
});

test("buildOAuthRedirectUri handles deeply nested paths", () => {
  assert.equal(
    buildOAuthRedirectUri({ origin: "https://example.com", pathname: "/app/game" }),
    "https://example.com/app/game",
  );
});
