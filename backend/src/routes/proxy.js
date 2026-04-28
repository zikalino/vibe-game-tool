import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

const GITHUB_CLIENT_SECRET = process.env.GH_CLIENT_SECRET;

if (!GITHUB_CLIENT_SECRET) {
  throw new Error("GH_CLIENT_SECRET environment variable is required");
}

/**
 * POST /api/github/oauth/access_token
 * Body: application/x-www-form-urlencoded
 *   client_id, code, redirect_uri?, state?, code_verifier?
 *
 * Transparent server-side proxy for GitHub's OAuth token exchange endpoint.
 * Adds client_secret from the server environment so the browser never needs it,
 * and avoids browser CORS restrictions on the GitHub token endpoint.
 * Returns GitHub's JSON token response (access_token, token_type, scope).
 */
router.post("/oauth/access_token", async (req, res) => {
  const { client_id, code, redirect_uri, state, code_verifier } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Missing required field: code" });
  }
  if (!client_id) {
    return res.status(400).json({ error: "Missing required field: client_id" });
  }

  const tokenParams = new URLSearchParams({ client_id, code });
  if (redirect_uri) tokenParams.set("redirect_uri", redirect_uri);
  if (state) tokenParams.set("state", state);
  if (code_verifier) tokenParams.set("code_verifier", code_verifier);
  tokenParams.set("client_secret", GITHUB_CLIENT_SECRET);

  let tokenData;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });
    tokenData = await tokenRes.json();
  } catch (err) {
    console.error("GitHub token proxy network error:", err);
    return res.status(502).json({ error: "Failed to reach GitHub token endpoint" });
  }

  if (tokenData.error) {
    return res.status(400).json({
      error: tokenData.error,
      error_description: tokenData.error_description,
    });
  }

  return res.json(tokenData);
});

export default router;
