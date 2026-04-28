import { Router } from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import { upsertUser } from "../db.js";

const router = Router();

const GITHUB_CLIENT_ID = process.env.GH_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GH_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const GH_SPONSOR_LOGIN = process.env.GH_SPONSOR_LOGIN || "";

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  throw new Error("GH_CLIENT_ID and GH_CLIENT_SECRET environment variables are required");
}

/**
 * POST /api/auth/github
 * Body: { code: "<oauth code>", code_verifier?: "<pkce verifier>" }
 *
 * Exchanges a GitHub OAuth authorization code for an access token,
 * fetches the authenticated user's profile, upserts the user in the
 * database, and returns a signed JWT.
 */
router.post("/github", async (req, res) => {
  const { code, code_verifier } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Missing required field: code" });
  }

  // Exchange code for GitHub access token
  const tokenParams = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    code,
  });
  if (code_verifier) {
    tokenParams.set("code_verifier", code_verifier);
  }

  let githubTokenData;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });
    githubTokenData = await tokenRes.json();
  } catch (err) {
    console.error("GitHub token exchange network error:", err);
    return res.status(502).json({ error: "Failed to reach GitHub token endpoint" });
  }

  if (githubTokenData.error) {
    return res.status(400).json({
      error: githubTokenData.error,
      error_description: githubTokenData.error_description,
    });
  }

  const { access_token } = githubTokenData;

  // Fetch GitHub user profile
  let profile;
  try {
    const profileRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!profileRes.ok) {
      throw new Error(`GitHub API responded with ${profileRes.status}`);
    }
    profile = await profileRes.json();
  } catch (err) {
    console.error("GitHub profile fetch error:", err);
    return res.status(502).json({ error: "Failed to fetch GitHub user profile" });
  }

  // Upsert user and create JWT
  const isSponsor = GH_SPONSOR_LOGIN
    ? await checkSponsor(access_token, profile.login, GH_SPONSOR_LOGIN)
    : false;

  const user = upsertUser({
    github_id: String(profile.id),
    login: profile.login,
    name: profile.name || null,
    avatar_url: profile.avatar_url || null,
    is_sponsor: isSponsor ? 1 : 0,
  });

  const token = jwt.sign(
    { sub: user.id, github_id: user.github_id, login: user.login },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

  return res.json({ token, user: { id: user.id, login: user.login, name: user.name, avatar_url: user.avatar_url, is_sponsor: user.is_sponsor === 1 } });
});

/**
 * Check whether `sponsorLogin` is an active GitHub sponsor of `ownerLogin`
 * using the GitHub GraphQL API.  Returns false on any error so that auth
 * always succeeds even if the sponsor check fails.
 */
async function checkSponsor(accessToken, sponsorLogin, ownerLogin) {
  try {
    const query = `query($owner:String!,$sponsor:String!){
      user(login:$owner){ isSponsoredBy(accountLogin:$sponsor) }
    }`;
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ query, variables: { owner: ownerLogin, sponsor: sponsorLogin } }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.data?.user?.isSponsoredBy === true;
  } catch (err) {
    console.error("Sponsor check error:", err);
    return false;
  }
}

export default router;
