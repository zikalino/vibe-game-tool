import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGitHubAuthorizeUrl,
  createPkceChallenge,
  createPkceVerifier,
  formatGitHubCallbackDiagnostics,
  getGitHubAuthUnavailableMessage,
  isGitHubAuthSession,
  parseGitHubCallbackParams,
  resolveGitHubClientId,
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
