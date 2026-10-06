// Demo data: deletes ALL submissions (rows, photo rows and the photo files in Storage) and creates realistic samples.
// Run:  node scripts/seed-demo.js        (asks for confirmation; add --yes to skip the question)
// Run `npm run seed` first: it creates the sites, the hazard types and the base users this script relies on.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { pool } from "../src/db.js";
import { uploadPhoto, removePhotos } from "../src/storage.js";

const PHOTO_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "demo-photos");

const CHECKLIST_COLUMNS = [
  "ppe_hard_hat",
  "ppe_vest",
  "ppe_boots",
  "ppe_eye_protection",
  "fall_protection_in_place",
  "ladders_inspected",
  "scaffolding_inspected",
  "tools_good_condition",
  "cords_good_condition",
];

// Two extra framers, so that "Not submitted yet" has something to show
const EXTRA_FRAMERS = [
  { email: "framer3@ras.test", firstName: "Alex", lastName: "Rivera" },
  { email: "framer4@ras.test", firstName: "Taylor", lastName: "Nguyen" },
];
const FRAMER_PASSWORD = "Framer123!";

// One entry per submission. `no` lists the checklist items answered No (everything else is Yes).
// daysAgo 0 is today. Jordan Lee and Taylor Nguyen have not submitted today on purpose.
const DEMO = [
  { who: "framer1@ras.test", site: "Maple Street", daysAgo: 0, status: "submitted", no: [], hazards: [],
    notes: "Framing crew on level 2. Weather clear.", photos: ["site-conditions.jpg"] },
  { who: "framer3@ras.test", site: "Harbor View", daysAgo: 0, status: "submitted", no: ["ppe_vest"], hazards: ["Slip / trip"],
    notes: "Wet decking after overnight rain. One vest left in the truck, brought out before work started.", photos: ["hazard-slip.jpg"] },

  { who: "framer1@ras.test", site: "Maple Street", daysAgo: 1, status: "reviewed", no: [], hazards: [],
    notes: "", photos: ["ppe-check.jpg"] },
  { who: "framer2@ras.test", site: "Oak Ridge", daysAgo: 1, status: "submitted", no: ["scaffolding_inspected", "fall_protection_in_place"], hazards: ["Falling objects"],
    notes: "Scaffold tags missing on the north side. Work paused until it is inspected.", photos: ["scaffold.jpg", "site-conditions.jpg"] },
  { who: "framer3@ras.test", site: "Harbor View", daysAgo: 1, status: "reviewed", no: [], hazards: [], notes: "", photos: [] },
  { who: "framer4@ras.test", site: "Maple Street", daysAgo: 1, status: "submitted", no: ["ppe_eye_protection"], hazards: [],
    notes: "Eye protection handed out after lunch.", photos: [] },

  { who: "framer1@ras.test", site: "Maple Street", daysAgo: 2, status: "reviewed", no: [], hazards: [], notes: "", photos: [] },
  { who: "framer2@ras.test", site: "Oak Ridge", daysAgo: 2, status: "reviewed", no: [], hazards: [], notes: "", photos: [] },
  { who: "framer4@ras.test", site: "Harbor View", daysAgo: 2, status: "reviewed", no: ["cords_good_condition"], hazards: ["Electrical"],
    notes: "Damaged extension cord taken out of service and replaced.", photos: ["site-conditions.jpg"] },

  { who: "framer3@ras.test", site: "Oak Ridge", daysAgo: 3, status: "reviewed", no: [], hazards: [], notes: "", photos: [] },
  { who: "framer1@ras.test", site: "Maple Street", daysAgo: 3, status: "reviewed", no: ["tools_good_condition"], hazards: [],
    notes: "Nail gun nose was chipped, swapped for a spare.", photos: [] },

  { who: "framer2@ras.test", site: "Harbor View", daysAgo: 4, status: "reviewed", no: [], hazards: [], notes: "", photos: [] },
  { who: "framer4@ras.test", site: "Oak Ridge", daysAgo: 4, status: "reviewed", no: [], hazards: [], notes: "", photos: [] },

  { who: "framer1@ras.test", site: "Harbor View", daysAgo: 5, status: "reviewed", no: [], hazards: ["Fire"],
    notes: "Hot work permit on file. Fire extinguisher at the cutting station.", photos: ["site-conditions.jpg"] },
  { who: "framer3@ras.test", site: "Maple Street", daysAgo: 5, status: "reviewed", no: [], hazards: [], notes: "", photos: [] },

  { who: "framer2@ras.test", site: "Maple Street", daysAgo: 6, status: "reviewed", no: [], hazards: [], notes: "", photos: [] },
  { who: "framer4@ras.test", site: "Oak Ridge", daysAgo: 6, status: "reviewed", no: [], hazards: [], notes: "", photos: [] },
];

const pad = (n) => String(n).padStart(2, "0");

// Local calendar date n days ago as "YYYY-MM-DD" (this script runs on your computer, so it is your "today")
function dateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// When the form was "sent": earlier today for today's rows, early morning for older days
function sentAt(daysAgo, index) {
  if (daysAgo === 0) return new Date(Date.now() - (20 + index * 35) * 60 * 1000);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(6, 15 + ((index * 7) % 50), 0, 0);
  return d;
}

async function confirmWipe() {
  if (process.argv.includes("--yes")) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // If the input is closed (nobody can answer), the "close" event settles the question as "no"
  const inputClosed = new Promise((resolve) => rl.once("close", () => resolve("")));
  try {
    const answer = await Promise.race([
      rl.question("This deletes ALL submissions, photos and photo files, then creates demo data. Type yes to continue: "),
      inputClosed,
    ]);
    return answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

// { "Maple Street": "1", ... } from query rows
function lookup(rows, nameColumn, idColumn) {
  return Object.fromEntries(rows.map((row) => [row[nameColumn], row[idColumn]]));
}

async function main() {
  if (!(await confirmWipe())) {
    console.log("Cancelled. Nothing was changed.");
    return;
  }

  // 1. Two more framers (skipped if they already exist)
  const passwordHash = await bcrypt.hash(FRAMER_PASSWORD, 10);
  for (const framer of EXTRA_FRAMERS) {
    await pool.query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, 'framer', $3, $4) ON CONFLICT (email) DO NOTHING`,
      [framer.email, passwordHash, framer.firstName, framer.lastName]
    );
  }

  // 2. Check that everything the demo data refers to exists, BEFORE anything is deleted
  const users = lookup((await pool.query("SELECT user_id, email FROM users")).rows, "email", "user_id");
  const sites = lookup((await pool.query("SELECT site_id, site_name FROM sites")).rows, "site_name", "site_id");
  const hazards = lookup((await pool.query("SELECT hazard_id, hazard_type FROM hazards")).rows, "hazard_type", "hazard_id");
  for (const entry of DEMO) {
    const missing = [
      !users[entry.who] && `user ${entry.who}`,
      !sites[entry.site] && `site ${entry.site}`,
      ...entry.hazards.filter((name) => !hazards[name]).map((name) => `hazard ${name}`),
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`Missing ${missing.join(", ")}. Run "npm run seed" first. Nothing was deleted.`);
    }
  }

  // 3. Delete the old submissions. Child tables first, and the Storage files too (otherwise they would be orphans).
  const { rows: oldPhotos } = await pool.query("SELECT storage_path FROM photos");
  const oldPaths = oldPhotos.map((row) => row.storage_path);
  for (let i = 0; i < oldPaths.length; i += 100) await removePhotos(oldPaths.slice(i, i + 100));
  await pool.query("TRUNCATE photos, submissions_hazards, submissions RESTART IDENTITY");
  console.log(`Deleted old submissions and ${oldPaths.length} photo file(s).`);

  const photoFiles = {};
  for (const file of new Set(DEMO.flatMap((entry) => entry.photos))) {
    photoFiles[file] = fs.readFileSync(path.join(PHOTO_DIR, file));
  }

  // 4. Create the submissions, oldest first (so ids grow with time)
  const ordered = DEMO.map((entry, index) => ({ ...entry, index })).sort((a, b) => b.daysAgo - a.daysAgo);
  let photoCount = 0;
  for (const entry of ordered) {
    const userId = users[entry.who];
    const siteId = sites[entry.site];
    const hazardIds = entry.hazards.map((name) => hazards[name]);

    const client = await pool.connect();
    const uploaded = [];
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO submissions (user_id, site_id, work_date, status, notes, created_at, ${CHECKLIST_COLUMNS.join(", ")})
         VALUES ($1, $2, $3, $4, $5, $6, ${CHECKLIST_COLUMNS.map((_, i) => `$${i + 7}`).join(", ")})
         RETURNING submission_id`,
        [
          userId, siteId, dateString(entry.daysAgo), entry.status, entry.notes || null, sentAt(entry.daysAgo, entry.index),
          ...CHECKLIST_COLUMNS.map((column) => !entry.no.includes(column)),
        ]
      );
      const submissionId = rows[0].submission_id;

      for (const hazardId of hazardIds) {
        await client.query("INSERT INTO submissions_hazards (submission_id, hazard_id) VALUES ($1, $2)", [submissionId, hazardId]);
      }
      for (const file of entry.photos) {
        const storagePath = `${submissionId}/${randomUUID()}.jpg`;
        await uploadPhoto(storagePath, photoFiles[file], "image/jpeg");
        uploaded.push(storagePath);
        await client.query("INSERT INTO photos (submission_id, photo_name, storage_path) VALUES ($1, $2, $3)", [submissionId, file, storagePath]);
        photoCount += 1;
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      await removePhotos(uploaded);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(`Created ${ordered.length} submissions with ${photoCount} photo(s).`);
  console.log("Extra demo framers: framer3@ras.test and framer4@ras.test (password Framer123!).");
}

try {
  await main();
} catch (err) {
  console.error("Demo seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
