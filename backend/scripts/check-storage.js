// Diagnostic: shows which Storage buckets the configured URL + secret key can see,
// and whether SUPABASE_BUCKET matches one of them. Run with: node scripts/check-storage.js
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_BUCKET } = process.env;

// JSON.stringify makes hidden problems visible (extra spaces, quotes, wrong letter case)
console.log("SUPABASE_URL:", JSON.stringify(SUPABASE_URL));
console.log("SUPABASE_BUCKET:", JSON.stringify(SUPABASE_BUCKET));
// The key itself is never printed
console.log("Key starts with sb_secret_:", SUPABASE_SECRET_KEY?.startsWith("sb_secret_") ?? false);

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("SUPABASE_URL or SUPABASE_SECRET_KEY is missing in backend/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data, error } = await supabase.storage.listBuckets();

if (error) {
  console.error("Could not list buckets:", error.message);
  console.error("-> The URL or the secret key is probably wrong (or belongs to a different project).");
  process.exit(1);
}

console.log("Buckets in this project:");
for (const bucket of data) {
  console.log(`  ${JSON.stringify(bucket.id)} (${bucket.public ? "public" : "private"})`);
}
console.log(
  data.some((bucket) => bucket.id === SUPABASE_BUCKET)
    ? "OK: SUPABASE_BUCKET matches an existing bucket."
    : "PROBLEM: no bucket has exactly that name. Copy one of the names above into SUPABASE_BUCKET."
);
