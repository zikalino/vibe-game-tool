import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserById } from "../db.js";

const router = Router();

/**
 * GET /api/me
 * Returns the authenticated user's profile from the database.
 */
router.get("/", requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json({
    id: user.id,
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    is_sponsor: user.is_sponsor === 1,
    created_at: user.created_at,
  });
});

export default router;
