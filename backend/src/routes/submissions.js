import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { pool } from "../db.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { uploadPhoto, removePhotos, StorageError } from "../storage.js";
import { detectImageType } from "../utils/imageType.js";
import { isId, isValidDate } from "../utils/validation.js";

const router = Router();

// Photo rules (keep in sync with the constants in frontend/components/SafetyForm.js)
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB each

// Files are kept in memory just long enough to be forwarded to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS },
});

// Runs multer and turns its errors into friendly 400 responses
function handleUpload(req, res, next) {
  upload.array("photos", MAX_PHOTOS)(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Each photo must be 10 MB or smaller." });
    }
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: `You can attach up to ${MAX_PHOTOS} photos.` });
    }
    next(err);
  });
}

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

// Returns an error message for the first problem found, or null if the body is valid
function validate(body) {
  if (!body || typeof body !== "object") return "Invalid form data.";
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

// Most rows the list returns in one response
const LIST_LIMIT = 500;

// GET /api/submissions?siteId=&userId=&from=&to=  (admins only)
// Every filter is optional. Rows come back grouped by site (sorted by site name), newest date first.
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  const { siteId, userId, from, to } = req.query;

  if (siteId && !isId(siteId)) return res.status(400).json({ error: "Invalid site." });
  if (userId && !isId(userId)) return res.status(400).json({ error: "Invalid worker." });
  if (from && !isValidDate(from)) return res.status(400).json({ error: "Invalid 'from' date." });
  if (to && !isValidDate(to)) return res.status(400).json({ error: "Invalid 'to' date." });
  if (from && to && from > to) {
    return res.status(400).json({ error: "The 'from' date must not be after the 'to' date." });
  }

  // Build the WHERE clause from the filters that were given. Values always go in `params`
  // (never into the SQL text), so user input cannot change the query.
  const conditions = [];
  const params = [];
  const addFilter = (sql, value) => {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  };
  if (siteId) addFilter("s.site_id = ?", siteId);
  if (userId) addFilter("s.user_id = ?", userId);
  if (from) addFilter("s.work_date >= ?", from);
  if (to) addFilter("s.work_date <= ?", to);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // work_date::text keeps the date as "2026-10-03" (a JS Date could shift it by a day across time zones)
  const { rows } = await pool.query(
    `SELECT s.submission_id, s.work_date::text AS work_date, s.status, s.created_at,
            st.site_id, st.site_name, u.user_id, u.first_name, u.last_name,
            (SELECT COUNT(*) FROM photos p WHERE p.submission_id = s.submission_id)::int AS photo_count
     FROM submissions s
     JOIN sites st ON st.site_id = s.site_id
     JOIN users u ON u.user_id = s.user_id
     ${where}
     ORDER BY st.site_name, s.work_date DESC, u.last_name, u.first_name
     LIMIT ${LIST_LIMIT}`,
    params
  );

  res.json(
    rows.map((r) => ({
      id: String(r.submission_id),
      workDate: r.work_date,
      status: r.status,
      createdAt: r.created_at,
      photoCount: r.photo_count,
      site: { id: String(r.site_id), name: r.site_name },
      worker: { id: String(r.user_id), name: `${r.first_name} ${r.last_name}` },
    }))
  );
});

// POST /api/submissions  (framers only)
// multipart/form-data with a "payload" field (the form answers as JSON text) and 0-5 "photos" files
router.post("/", authenticate, requireRole("framer"), handleUpload, async (req, res) => {
  let body;
  try {
    body = JSON.parse(req.body?.payload);
  } catch {
    return res.status(400).json({ error: "Invalid form data." });
  }
  const problem = validate(body);
  if (problem) return res.status(400).json({ error: problem });

  // Check what each file really is, based on its content
  const photos = [];
  for (const file of req.files || []) {
    const type = detectImageType(file.buffer);
    if (!type) {
      return res.status(400).json({ error: `"${file.originalname}" is not a JPEG, PNG or WebP image.` });
    }
    // Browsers send filenames as UTF-8 but multer reads them as latin1, so convert to keep non-English names readable
    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
    photos.push({ buffer: file.buffer, name: path.basename(originalName).slice(0, 255), ...type });
  }

  const columns = Object.values(CHECKLIST);
  const checklistValues = Object.keys(CHECKLIST).map((key) => body[key]);
  const hazardIds = [...new Set(body.hazardIds.map(String))]; // drop duplicates
  const notes = body.notes?.trim() || null;

  const client = await pool.connect();
  const uploadedPaths = [];
  try {
    // Everything below is saved together: if any step fails, the database changes are rolled back
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

    // Photos are uploaded after the submission row exists, so duplicates are rejected before any upload.
    // The storage path uses a random name, never the user's filename (storage only allows certain characters).
    for (const photo of photos) {
      const storagePath = `${submission.submission_id}/${randomUUID()}.${photo.ext}`;
      await uploadPhoto(storagePath, photo.buffer, photo.mime);
      uploadedPaths.push(storagePath);
      await client.query(
        "INSERT INTO photos (submission_id, photo_name, storage_path) VALUES ($1, $2, $3)",
        [submission.submission_id, photo.name, storagePath]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({
      submission: {
        id: String(submission.submission_id),
        status: submission.status,
        createdAt: submission.created_at,
        photoCount: photos.length,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    await removePhotos(uploadedPaths); // do not leave orphan files in the bucket

    if (err.code === "23505") {
      // unique_violation: same user + site + date already exists
      return res.status(409).json({ error: "You already submitted a form for this site and date." });
    }
    if (err.code === "23503") {
      // foreign_key_violation: the site or a hazard id does not exist
      return res.status(400).json({ error: "The selected site or hazard does not exist." });
    }
    if (err instanceof StorageError) {
      console.error("Photo upload failed:", err.message);
      return res.status(502).json({ error: "Photo upload failed. Nothing was saved, please try again." });
    }
    console.error("Create submission failed:", err.message);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

export default router;
