import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listArtifacts,
  getArtifact,
  createArtifact,
  updateArtifact,
  deleteArtifact,
} from "../db.js";

const router = Router();

const VALID_TYPES = ["map", "tile"];
const MAX_DATA_BYTES = 1024 * 1024; // 1 MB

/** Parse the stored JSON data string back to an object, mutating the artifact in place. */
function parseData(artifact) {
  try {
    artifact.data = JSON.parse(artifact.data);
  } catch {
    // leave as raw string if not valid JSON
  }
  return artifact;
}

/**
 * Serialize the request body's data field to a JSON string and validate its size.
 * Returns { dataStr } on success or sends a 400 response and returns null.
 */
function serializeData(data, res) {
  const dataStr = JSON.stringify(data ?? {});
  if (Buffer.byteLength(dataStr, "utf8") > MAX_DATA_BYTES) {
    res.status(400).json({ error: "Data payload too large (max 1 MB)" });
    return null;
  }
  return dataStr;
}

/**
 * GET /api/artifacts
 * Returns all artifacts (id, name, type, timestamps) for the authenticated user.
 */
router.get("/", requireAuth, (req, res) => {
  const artifacts = listArtifacts(req.user.sub);
  return res.json(artifacts);
});

/**
 * GET /api/artifacts/:id
 * Returns a single artifact including its data payload.
 */
router.get("/:id", requireAuth, (req, res) => {
  const artifact = getArtifact(Number(req.params.id), req.user.sub);
  if (!artifact) {
    return res.status(404).json({ error: "Artifact not found" });
  }
  return res.json(parseData(artifact));
});

/**
 * POST /api/artifacts
 * Creates a new artifact.
 * Body: { name: string, type: "map"|"tile", data?: object }
 */
router.post("/", requireAuth, (req, res) => {
  const { name, type, data } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Missing or invalid field: name" });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
    });
  }

  const dataStr = serializeData(data, res);
  if (dataStr === null) return;

  const artifact = createArtifact(req.user.sub, name.trim(), type, dataStr);
  return res.status(201).json(parseData(artifact));
});

/**
 * PUT /api/artifacts/:id
 * Updates the name and/or data of an existing artifact.
 * Body: { name: string, data?: object }
 */
router.put("/:id", requireAuth, (req, res) => {
  const existing = getArtifact(Number(req.params.id), req.user.sub);
  if (!existing) {
    return res.status(404).json({ error: "Artifact not found" });
  }

  const { name, data } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Missing or invalid field: name" });
  }

  const dataStr = serializeData(data, res);
  if (dataStr === null) return;

  const artifact = updateArtifact(Number(req.params.id), req.user.sub, name.trim(), dataStr);
  return res.json(parseData(artifact));
});

/**
 * DELETE /api/artifacts/:id
 * Deletes an artifact owned by the authenticated user.
 */
router.delete("/:id", requireAuth, (req, res) => {
  const existing = getArtifact(Number(req.params.id), req.user.sub);
  if (!existing) {
    return res.status(404).json({ error: "Artifact not found" });
  }
  deleteArtifact(Number(req.params.id), req.user.sub);
  return res.json({ deleted: true });
});

export default router;
