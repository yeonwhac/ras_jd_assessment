"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

const MAX_ROWS = 500; // keep in sync with LIST_LIMIT in backend/src/routes/submissions.js

// Status colors for the status pill
const STATUS_STYLES = {
  submitted: "bg-amber-100 text-amber-800",
  reviewed: "bg-green-100 text-green-800",
};

const fieldClass =
  "h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-accent";

const NO_FILTERS = { siteId: "", userId: "", from: "", to: "" };

export default function SubmissionList() {
  // Options for the filter dropdowns
  const [sites, setSites] = useState([]);
  const [workers, setWorkers] = useState([]);

  const [filters, setFilters] = useState(NO_FILTERS);
  const [submissions, setSubmissions] = useState(null); // null until the first load finishes
  const [error, setError] = useState("");

  // Load the dropdown options once
  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [siteList, workerList] = await Promise.all([apiFetch("/api/sites"), apiFetch("/api/workers")]);
        if (!cancelled) {
          setSites(siteList);
          setWorkers(workerList);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reload the list whenever a filter changes
  useEffect(() => {
    let cancelled = false;

    async function loadList() {
      const params = new URLSearchParams(); // empty search params string (will be key=value&key2=value2...)
      for (const [key, value] of Object.entries(filters)) { // [["A","B"],["C",""], ...]
        if (value) params.set(key, value); // empty filters are left out
      }
      // params example: siteId=1&from=2026-10-01
      try {
        const data = await apiFetch(`/api/submissions?${params}`);
        if (!cancelled) {
          setSubmissions(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    loadList();
    // If a newer request starts before this one finishes, the old answer is ignored
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function updateFilter(name, value) {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  // The API sorts by site name, so rows of the same site are next to each other: group them in one pass
  const groups = [];
  for (const row of submissions ?? []) {
    const last = groups[groups.length - 1];
    if (last && last.siteId === row.site.id) last.rows.push(row);
    else groups.push({ siteId: row.site.id, siteName: row.site.name, rows: [row] });
  }

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <section className="flex flex-col gap-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">All submissions</h2>
        {hasFilters && (
          <button
            type="button"
            onClick={() => setFilters(NO_FILTERS)}
            className="rounded px-2 py-1 text-sm text-zinc-600 underline underline-offset-4"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
          <label htmlFor="filter-site" className="text-sm font-medium">
            Site
          </label>
          <select
            id="filter-site"
            value={filters.siteId}
            onChange={(e) => updateFilter("siteId", e.target.value)}
            className={fieldClass}
          >
            <option value="">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
          <label htmlFor="filter-worker" className="text-sm font-medium">
            Worker
          </label>
          <select
            id="filter-worker"
            value={filters.userId}
            onChange={(e) => updateFilter("userId", e.target.value)}
            className={fieldClass}
          >
            <option value="">All workers</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
                {worker.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filter-from" className="text-sm font-medium">
            From
          </label>
          <input
            id="filter-from"
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter("from", e.target.value)}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filter-to" className="text-sm font-medium">
            To
          </label>
          <input
            id="filter-to"
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter("to", e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!submissions && !error && <p className="text-zinc-500">Loading…</p>}

      {submissions && submissions.length === 0 && (
        <p className="rounded-md border border-zinc-200 px-4 py-6 text-center text-zinc-600">
          No submissions match these filters.
        </p>
      )}

      {submissions && submissions.length > 0 && (
        <p className="text-sm text-zinc-600">
          {submissions.length} submission{submissions.length === 1 ? "" : "s"}
          {submissions.length >= MAX_ROWS && ` (showing the first ${MAX_ROWS}, narrow the filters to see others)`}
        </p>
      )}

      {groups.map((group) => (
        <div key={group.siteId} className="overflow-hidden rounded-md border border-zinc-200">
          <h3 className="flex justify-between bg-zinc-50 px-4 py-2 font-semibold">
            <span>{group.siteName}</span>
            <span className="font-normal text-zinc-600">{group.rows.length}</span>
          </h3>
          <ul className="divide-y divide-zinc-200">
            {group.rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-36 flex-1 font-medium">{row.worker.name}</span>
                <span className="w-28 text-zinc-700">{formatDate(row.workDate)}</span>
                <span className="w-20 text-sm text-zinc-500">
                  {row.photoCount} photo{row.photoCount === 1 ? "" : "s"}
                </span>
                <span
                  className={`w-24 rounded-full py-0.5 text-center text-sm ${STATUS_STYLES[row.status] ?? "bg-zinc-100"}`}
                >
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
