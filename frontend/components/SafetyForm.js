"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { CHECKLIST_GROUPS } from "@/lib/checklist";
import YesNoField from "@/components/YesNoField";

// Today's date as YYYY-MM-DD in the user's local time zone (the "en-CA" locale formats dates that way)
const todayLocal = () => new Date().toLocaleDateString("en-CA");

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

  function resetForm() {
    setSiteId("");
    setWorkDate(todayLocal());
    setAnswers({});
    setHazardIds([]);
    setNotes("");
    setError("");
    setSubmitted(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiFetch("/api/submissions", {
        method: "POST",
        body: { siteId, workDate, ...answers, hazardIds, notes },
      });
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

      <button
        type="submit"
        disabled={submitting}
        className="h-12 rounded-md bg-brand text-base font-medium text-brand-contrast disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit form"}
      </button>
    </form>
  );
}
