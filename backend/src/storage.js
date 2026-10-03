import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_BUCKET } = process.env;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SUPABASE_BUCKET) {
  console.error("SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_BUCKET must be set. See .env.example.");
  process.exit(1);
}

// The secret key bypasses storage access rules, so it must only ever be used here on the server.
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const bucket = supabase.storage.from(SUPABASE_BUCKET);

export class StorageError extends Error {}

// Uploads one file to the private bucket. `path` is the file's location inside the bucket.
export async function uploadPhoto(path, buffer, contentType) {
  const { error } = await bucket.upload(path, buffer, { contentType, upsert: false });
  if (error) throw new StorageError(error.message);
}

// Best-effort cleanup of files whose database rows were rolled back.
export async function removePhotos(paths) {
  if (paths.length === 0) return;
  const { error } = await bucket.remove(paths);
  if (error) console.error("Storage cleanup failed:", error.message);
}
