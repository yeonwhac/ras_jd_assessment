import { Router } from "express";
import { pool } from "../db.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { isValidDate } from "../utils/validation.js";

const router = Router();

// GET /api/summary?date=2026-10-03  (admins only)
// The browser sends its own local "today", because the server's date can differ by a day (time zones).
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  const { date } = req.query;
  if (!isValidDate(date)) return res.status(400).json({ error: "Enter a valid date." });

  const [perSite, notSubmitted] = await Promise.all([
    // LEFT JOIN keeps sites with zero submissions in the result (their count is 0)
    pool.query(
      `SELECT st.site_id, st.site_name, COUNT(s.submission_id)::int AS count
       FROM sites st
       LEFT JOIN submissions s ON s.site_id = st.site_id AND s.work_date = $1
       GROUP BY st.site_id, st.site_name
       ORDER BY st.site_name`,
      [date]
    ),
    // Active framers who have no submission at all on that date
    pool.query(
      `SELECT u.user_id, u.first_name, u.last_name
       FROM users u
       WHERE u.role = 'framer' AND u.is_active
         AND NOT EXISTS (
           SELECT 1 FROM submissions s WHERE s.user_id = u.user_id AND s.work_date = $1
         )
       ORDER BY u.last_name, u.first_name`,
      [date]
    ),
  ]);

  res.json({
    date,
    perSite: perSite.rows.map((r) => ({ id: String(r.site_id), name: r.site_name, count: r.count })),
    notSubmitted: notSubmitted.rows.map((r) => ({
      id: String(r.user_id),
      name: `${r.first_name} ${r.last_name}`,
    })),
  });
});

export default router;
