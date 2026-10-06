import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { pool } from "../db.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { uploadPhoto, removePhotos, getPhotoUrls, StorageError } from "../storage.js";
import { detectImageType } from "../utils/imageType.js";
import { isId, isValidDate } from "../utils/validation.js";

const router = Router();

// Photo rules (keep in sync with the constants in frontend/components/SafetyForm.js)
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB each

// Files are kept in memory (not server disk) just long enough to be forwarded to Supabase Storage
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

const STATUSES = ["submitted", "reviewed"];

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

// GET /api/submissions/mine  (framers only) -> the logged-in framer's own submissions, newest first.
// This route must stay above "/:id", otherwise "mine" would be read as an id.
router.get("/mine", authenticate, requireRole("framer"), async (req, res) => {
  // The user comes from the verified token, so a framer can only ever list their own submissions
  const { rows } = await pool.query(
    `SELECT s.submission_id, s.work_date::text AS work_date, s.status, s.created_at,
            st.site_id, st.site_name,
            (SELECT COUNT(*) FROM photos p WHERE p.submission_id = s.submission_id)::int AS photo_count
     FROM submissions s
     JOIN sites st ON st.site_id = s.site_id
     WHERE s.user_id = $1
     ORDER BY s.work_date DESC, s.created_at DESC
     LIMIT ${LIST_LIMIT}`,
    [req.user.id]
  );

  res.json(
    rows.map((r) => ({
      id: String(r.submission_id),
      workDate: r.work_date,
      status: r.status,
      createdAt: r.created_at,
      photoCount: r.photo_count,
      site: { id: String(r.site_id), name: r.site_name },
    }))
  );
});

// GET /api/submissions/:id  (any logged-in user)
// Admins can open any submission, a framer only their own. Someone else's submission gets the same
// "not found" answer as one that does not exist, so ids cannot be probed.
router.get("/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(404).json({ error: "Submission not found." });

  const params = [id];
  let ownerFilter = "";
  if (req.user.role !== "admin") {
    params.push(req.user.id);
    ownerFilter = "AND s.user_id = $2";
  }

  const checklistColumns = Object.values(CHECKLIST).map((column) => `s.${column}`);
  const { rows } = await pool.query(
    `SELECT s.submission_id, s.work_date::text AS work_date, s.status, s.notes, s.created_at,
            ${checklistColumns.join(", ")},
            st.site_id, st.site_name, u.user_id, u.first_name, u.last_name
     FROM submissions s
     JOIN sites st ON st.site_id = s.site_id
     JOIN users u ON u.user_id = s.user_id
     WHERE s.submission_id = $1 ${ownerFilter}`,
    params
  );
  const submission = rows[0];
  if (!submission) return res.status(404).json({ error: "Submission not found." });

  const [hazardResult, photoResult] = await Promise.all([
    pool.query(
      `SELECT h.hazard_type FROM submissions_hazards sh
       JOIN hazards h ON h.hazard_id = sh.hazard_id
       WHERE sh.submission_id = $1 ORDER BY h.hazard_id`,
      [id]
    ),
    pool.query(
      "SELECT photo_id, photo_name, storage_path FROM photos WHERE submission_id = $1 ORDER BY photo_id",
      [id]
    ),
  ]);

  // Photos live in a private bucket, so each one gets a temporary link. If signing fails the
  // details still load, and the photos show up as unavailable.
  let photoUrls = new Map();
  try {
    photoUrls = await getPhotoUrls(photoResult.rows.map((photo) => photo.storage_path));
  } catch (err) {
    console.error("Could not create photo links:", err.message);
  }

  res.json({
    id: String(submission.submission_id),
    workDate: submission.work_date,
    status: submission.status,
    notes: submission.notes,
    createdAt: submission.created_at,
    site: { id: String(submission.site_id), name: submission.site_name },
    worker: { id: String(submission.user_id), name: `${submission.first_name} ${submission.last_name}` },
    // { ppeHardHat: true, ppeVest: false, ... }
    checklist: Object.fromEntries(Object.entries(CHECKLIST).map(([key, column]) => [key, submission[column]])),
    hazards: hazardResult.rows.map((row) => row.hazard_type),
    photos: photoResult.rows.map((photo) => ({
      id: String(photo.photo_id),
      name: photo.photo_name,
      url: photoUrls.get(photo.storage_path) ?? null,
    })),
  });
});

// PATCH /api/submissions/:id  { status: "reviewed" | "submitted" }  (admins only)
router.patch("/:id", authenticate, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const status = req.body?.status;
  if (!isId(id)) return res.status(404).json({ error: "Submission not found." });
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Status must be 'submitted' or 'reviewed'." });
  }

  const { rows } = await pool.query(
    "UPDATE submissions SET status = $1 WHERE submission_id = $2 RETURNING status",
    [status, id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Submission not found." });
  res.json({ status: rows[0].status });
});

// POST /api/submissions  (framers only)
// multipart/form-data with a "payload" field (the form answers as JSON text) and 0-5 "photos" files
router.post("/", authenticate, requireRole("framer"), handleUpload, async (req, res) => {
  let body;
  try {
    // parse FormData string to object
    body = JSON.parse(req.body?.payload);
  } catch {
    return res.status(400).json({ error: "Invalid form data." });
  }
  const problem = validate(body);
  if (problem) return res.status(400).json({ error: problem });

  // Check what each file really is, based on its content
  const photos = [];
  for (const file of req.files || []) {
    const type = detectImageType(file.buffer);  //check buffer to verify its image type
    if (!type) {
      return res.status(400).json({ error: `"${file.originalname}" is not a JPEG, PNG or WebP image.` });
    }
    // Browsers send filenames as UTF-8 but multer reads them as latin1, so convert to keep non-English names readable
    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
    // in case too long file name, truncate to 255 characters
    photos.push({ buffer: file.buffer, name: path.basename(originalName).slice(0, 255), ...type });
  }

  const columns = Object.values(CHECKLIST); // ppe_hard_hat, ppe_vest, ...
  const checklistValues = Object.keys(CHECKLIST).map((key) => body[key]); // actual true/false
  const hazardIds = [...new Set(body.hazardIds.map(String))]; // drop duplicates, back to strings
  const notes = body.notes?.trim() || null; // if whitespace only, just null

  const client = await pool.connect();
  const uploadedPaths = [];
  try {
    // Everything below is saved together: if any step fails, the database changes are rolled back
    await client.query("BEGIN");

    // The user comes from the verified token (req.user), never from the request body
    const { rows } = await client.query(
      // 1. append the checklist columns (ppe_hard_hat, ppe_vest, ...), 
      // 2. insert values from $5+ (ppe_hard_hat) after the first 4 columns (user_id, site_id, work_date, notes)
      // 3. return the new submission_id, status, and created_at
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
