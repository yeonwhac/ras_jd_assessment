import { Router } from "express";
import { pool } from "../db.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

// API field name -> database column, for every yes/no checklist question
const CHECKLIST = {
  ppeHardHat: "ppe_hard_hat",
  ppeVest: "ppe_vest",
  ppeBoots: "ppe_boots",
  ppeEyeProtection: "ppe_eye_protection",
  fallProtectionInPlace: "fall_protection_in_place",
  laddersInspected: "ladders_inspected",
  scaffoldingInspected: "scaffolding_inspected",
  toolsGoodCondition: "tools_good_condition",
  cordsGoodCondition: "cords_good_condition",
};

const isId = (value) => /^\d+$/.test(String(value));

// "2026-10-02" is valid, "2026-02-31" is not
function isValidDate(value) {
  // regex checks if the format is YYYY-MM-DD
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // create a Date object in UTC timezone
  const date = new Date(`${value}T00:00:00Z`);
  // check if the date is valid and matches the input
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Returns an error message for the first problem found, or null if the body is valid
function validate(body) {
  if (!isId(body.siteId)) return "Select a site.";
  if (!isValidDate(body.workDate)) return "Enter a valid date.";
  for (const key of Object.keys(CHECKLIST)) {
    if (typeof body[key] !== "boolean") return "Answer every checklist question.";
  }
  if (!Array.isArray(body.hazardIds) || !body.hazardIds.every(isId)) return "Invalid hazards.";
  if (body.notes != null && (typeof body.notes !== "string" || body.notes.length > 2000)) {
    return "Notes must be 2000 characters or less.";
  }
  return null;
}

// POST /api/submissions  (framers only) -> creates a safety form submission
router.post("/", authenticate, requireRole("framer"), async (req, res) => {
  const body = req.body || {};
  const problem = validate(body);
  if (problem) return res.status(400).json({ error: problem });

  const columns = Object.values(CHECKLIST);
  const checklistValues = Object.keys(CHECKLIST).map((key) => body[key]);
  const hazardIds = [...new Set(body.hazardIds.map(String))]; // drop duplicates
  const notes = body.notes?.trim() || null;

  const client = await pool.connect();
  try {
    // The submission and its hazards are saved together: either both succeed or neither does
    await client.query("BEGIN");

    // The user comes from the verified token (req.user), never from the request body
    const { rows } = await client.query(
      `INSERT INTO submissions (user_id, site_id, work_date, notes, ${columns.join(", ")})
       VALUES ($1, $2, $3, $4, ${columns.map((_, i) => `$${i + 5}`).join(", ")})
       RETURNING submission_id, status, created_at`,
      [req.user.id, body.siteId, body.workDate, notes, ...checklistValues]
    );
    const submission = rows[0];

    if (hazardIds.length > 0) {
      await client.query(
        `INSERT INTO submissions_hazards (submission_id, hazard_id)
         SELECT $1::bigint, unnest($2::bigint[])`,
        [submission.submission_id, hazardIds]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({
      submission: {
        id: String(submission.submission_id),
        status: submission.status,
        createdAt: submission.created_at,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      // unique_violation: same user + site + date already exists
      return res.status(409).json({ error: "You already submitted a form for this site and date." });
    }
    if (err.code === "23503") {
      // foreign_key_violation: the site or a hazard id does not exist
      return res.status(400).json({ error: "The selected site or hazard does not exist." });
    }
    console.error("Create submission failed:", err.message);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

export default router;
