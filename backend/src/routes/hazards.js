import { Router } from "express";
import { pool } from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// GET /api/hazards -> [{ id, name }]  (any logged-in user; used for the hazard checkboxes)
router.get("/", authenticate, async (req, res) => {
  const { rows } = await pool.query("SELECT hazard_id, hazard_type FROM hazards ORDER BY hazard_id");
  res.json(rows.map((r) => ({ id: String(r.hazard_id), name: r.hazard_type })));
});

export default router;
