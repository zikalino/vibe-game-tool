import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import db, { getUserData, setUserData, listUserData } from "../db.js";

const router = Router();

/**
 * GET /api/data
 * Returns all key/value entries for the authenticated user.
 */
router.get("/", requireAuth, (req, res) => {
  const rows = listUserData(req.user.sub);
  const result = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      result[row.key] = row.value;
    }
  }
  return res.json(result);
});

/**
 * GET /api/data/:key
 * Returns the value stored under the given key for the authenticated user.
 */
router.get("/:key", requireAuth, (req, res) => {
  const row = getUserData(req.user.sub, req.params.key);
  if (!row) {
    return res.status(404).json({ error: "Key not found" });
  }
  try {
    return res.json({ key: req.params.key, value: JSON.parse(row.value) });
  } catch {
    return res.json({ key: req.params.key, value: row.value });
  }
});

/**
 * PUT /api/data/:key
 * Stores a JSON value under the given key for the authenticated user.
 * Body: any valid JSON value.
 */
router.put("/:key", requireAuth, (req, res) => {
  const { key } = req.params;
  const value = JSON.stringify(req.body);
  setUserData(req.user.sub, key, value);
  return res.json({ key, value: req.body });
});

/**
 * DELETE /api/data/:key
 * Removes the entry for the given key for the authenticated user.
 */
router.delete("/:key", requireAuth, (req, res) => {
  const row = getUserData(req.user.sub, req.params.key);
  if (!row) {
    return res.status(404).json({ error: "Key not found" });
  }
  db.prepare("DELETE FROM user_data WHERE user_id = ? AND key = ?").run(req.user.sub, req.params.key);
  return res.json({ deleted: true });
});

export default router;
