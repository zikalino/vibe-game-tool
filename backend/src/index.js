import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import authRouter from "./routes/auth.js";
import meRouter from "./routes/me.js";
import dataRouter from "./routes/data.js";
import artifactsRouter from "./routes/artifacts.js";
import portalRouter from "./routes/portal.js";
import githubProxyRouter from "./routes/proxy.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Global rate limiter: 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Stricter limiter for auth endpoint to slow brute-force attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GitHub OAuth token exchange
app.use("/api/auth", authLimiter, authRouter);

// Transparent GitHub OAuth token proxy (used by the game client)
app.use("/api/github", authLimiter, githubProxyRouter);

// Authenticated user profile
app.use("/api/me", meRouter);

// User-scoped key/value data store
app.use("/api/data", dataRouter);

// Artifact storage (map and tile data)
app.use("/api/artifacts", artifactsRouter);

// User portal web page
app.use("/portal", portalRouter);

// Health check (used by Docker / Caddy to verify the service is up)
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
