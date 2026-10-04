"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { CHECKLIST_GROUPS } from "@/lib/checklist";
import YesNoField from "@/components/YesNoField";

// Today's date as YYYY-MM-DD in the user's local time zone (the "en-CA" locale formats dates that way)
const todayLocal = () => new Date().toLocaleDateString("en-CA");

// Photo rules (keep in sync with the constants in backend/src/routes/submissions.js)
const MAX_PHOTOS = 5;
const MAX_PHOTO_MB = 10;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fieldClass =
  "h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-accent";

export default function SafetyForm() {
  // Dropdown/checkbox options loaded from the API
  const [options, setOptions] = useState(null); // { sites, hazards }
  const [loadError, setLoadError] = useState("");

  // Form values
  const [siteId, setSiteId] = useState("");
  const [workDate, setWorkDate] = useState(todayLocal());
  const [answers, setAnswers] = useState({}); // e.g. { ppeHardHat: true, ppeVest: false }
  const [hazardIds, setHazardIds] = useState([]);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState([]); // [{ id, file, url }] where url is a local preview
  const [photoError, setPhotoError] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Load the sites and hazards once when the form opens
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [sites, hazards] = await Promise.all([apiFetch("/api/sites"), apiFetch("/api/hazards")]);
        if (!cancelled) setOptions({ sites, hazards });
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleHazard(id) {
    setHazardIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Checks each picked file in the browser first, so mistakes are caught before any upload
  function handleFiles(e) {
    const picked = Array.from(e.target.files);
    e.target.value = ""; // lets the user pick the same file again later

    const problems = [];
    const accepted = [];
    for (const file of picked) {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        problems.push(`${file.name}: only JPEG, PNG or WebP images are allowed.`);
      } else if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        problems.push(`${file.name}: larger than ${MAX_PHOTO_MB} MB.`);
      } else {
        accepted.push(file);
      }
    }

    const room = MAX_PHOTOS - photos.length;
    if (accepted.length > room) problems.push(`You can attach up to ${MAX_PHOTOS} photos.`);

    const added = accepted.slice(0, room).map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      url: URL.createObjectURL(file), // temporary local address used for the thumbnail
    }));
    setPhotos((prev) => [...prev, ...added]);
    setPhotoError(problems.join(" "));
  }

  function removePhoto(id) {
    const photo = photos.find((p) => p.id === id);
    if (photo) URL.revokeObjectURL(photo.url); // free the memory used by the preview
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setPhotoError("");
  }

  function clearPhotos() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setPhotoError("");
  }

  function resetForm() {
    clearPhotos();
    setSiteId("");
    setWorkDate(todayLocal());
    setAnswers({});
    setHazardIds([]);
    setNotes("");
    setError("");
    setSubmitted(false);
  }

  // True once the user has typed or picked anything, i.e. when a reset would actually throw something away
  const hasChanges =
    siteId !== "" ||
    workDate !== todayLocal() ||
    Object.keys(answers).length > 0 ||
    hazardIds.length > 0 ||
    notes !== "" ||
    photos.length > 0;

  // Reset button: ask first if there is something to lose, then start over from the top of the page
  function handleReset() {
    if (hasChanges && !window.confirm("Clear the whole form and start over?")) return;
    resetForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // The answers travel as one JSON text field, the photos as files, in a single multipart request
      const formData = new FormData();
      formData.append("payload", JSON.stringify({ siteId, workDate, ...answers, hazardIds, notes }));
      photos.forEach((photo) => formData.append("photos", photo.file));

      await apiFetch("/api/submissions", { method: "POST", body: formData });
      clearPhotos();
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {loadError}
      </p>
    );
  }

  if (!options) {
    return <p className="py-6 text-zinc-500">Loading form…</p>;
  }

  if (submitted) {
    return (
      <div role="status" className="flex flex-col gap-4 py-6">
        <p className="rounded-md bg-green-50 px-4 py-3 text-green-800">Form submitted. Thank you!</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={resetForm} className="h-12 rounded-md bg-brand px-5 text-brand-contrast">
            Submit another form
          </button>
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-md border border-zinc-300 px-5"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 py-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="site" className="text-sm font-medium">
            Job site
          </label>
          <select
            id="site"
            required
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Select a site</option>
            {options.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="date" className="text-sm font-medium">
            Date
          </label>
          <input
            id="date"
            type="date"
            required
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className={fieldClass}
          />
        </div>
      </section>

      {CHECKLIST_GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200 px-4">
            {group.items.map((item) => (
              <YesNoField
                key={item.key}
                name={item.key}
                label={item.label}
                value={answers[item.key]}
                onChange={(value) => setAnswers((prev) => ({ ...prev, [item.key]: value }))}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Hazards identified</h2>
        <p className="text-sm text-zinc-600">Select all that apply. Leave empty if there are none.</p>
        <div className="flex flex-wrap gap-2">
          {options.hazards.map((hazard) => (
            <label key={hazard.id} className="relative">
              <input
                type="checkbox"
                checked={hazardIds.includes(hazard.id)}
                onChange={() => toggleHazard(hazard.id)}
                className="peer sr-only"
              />
              <span className="flex h-11 cursor-pointer items-center rounded-full border border-zinc-300 px-4 peer-checked:border-accent peer-checked:bg-accent/15 peer-checked:font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                {hazard.name}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Photos</h2>
        <p className="text-sm text-zinc-600">
          Optional. Up to {MAX_PHOTOS} photos (JPEG, PNG or WebP, {MAX_PHOTO_MB} MB each): site conditions, PPE,
          hazards.
        </p>

        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <li
                key={photo.id}
                className="relative aspect-square overflow-hidden rounded-md border border-zinc-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.file.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  aria-label={`Remove ${photo.file.name}`}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-lg text-white"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {photos.length < MAX_PHOTOS && (
          <label className="flex h-12 cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-400 text-base focus-within:ring-2 focus-within:ring-accent">
            {photos.length === 0 ? "Add photos" : "Add more photos"}
            <input
              type="file"
              accept={ALLOWED_PHOTO_TYPES.join(",")}
              multiple
              onChange={handleFiles}
              className="sr-only"
            />
          </label>
        )}

        {photoError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {photoError}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-lg font-semibold">
          Notes
        </label>
        <textarea
          id="notes"
          rows={4}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else the supervisor should know (optional)"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </section>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="-mb-4 flex justify-end">
        <button
          type="button"
          onClick={handleReset}
          disabled={submitting}
          className="rounded px-2 py-2 text-sm text-zinc-600 underline underline-offset-4 hover:text-foreground disabled:opacity-60"
        >
          Reset form
        </button>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="h-12 rounded-md bg-brand text-base font-medium text-brand-contrast disabled:opacity-60"
      >
        {submitting ? (photos.length > 0 ? "Uploading…" : "Submitting…") : "Submit form"}
      </button>
    </form>
  );
}
