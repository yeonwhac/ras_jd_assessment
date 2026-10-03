import { Router } from "express";
import { pool } from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// GET /api/sites -> [{ id, name }]  (any logged-in user; used for the site dropdown)
router.get("/", authenticate, async (req, res) => {
  const { rows } = await pool.query("SELECT site_id, site_name FROM sites ORDER BY site_name");
  res.json(rows.map((r) => ({ id: String(r.site_id), name: r.site_name })));
});

export default router;
