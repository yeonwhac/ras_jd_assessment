import { Router } from "express";
import { pool } from "../db.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

// GET /api/workers -> [{ id, name, isActive }]  (admins only; used for the worker filter)
// Former workers are included too, because their old submissions can still be filtered.
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT user_id, first_name, last_name, is_active
     FROM users WHERE role = 'framer' ORDER BY last_name, first_name`
  );
  res.json(
    rows.map((r) => ({
      id: String(r.user_id),
      name: `${r.first_name} ${r.last_name}`,
      isActive: r.is_active,
    }))
  );
});

export default router;
