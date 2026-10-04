"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDate, todayLocal } from "@/lib/format";

// Two small cards for today: submissions per site, and who has not submitted yet
export default function SummaryPanel() {
  const [today] = useState(todayLocal); // fixed when the page opens
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch(`/api/summary?date=${today}`);
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [today]);

  if (error) {
    return (
      <p role="alert" className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (!summary) return <p className="mt-6 text-zinc-500">Loading summary…</p>;

  return (
    <section className="mt-6 flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Today · {formatDate(today)}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-4">
          <h3 className="text-sm font-medium text-zinc-600">Submitted per site</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {summary.perSite.map((site) => (
              <li key={site.id} className="flex justify-between">
                <span>{site.name}</span>
                <span className="font-medium">{site.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-zinc-200 p-4">
          <h3 className="text-sm font-medium text-zinc-600">Not submitted yet</h3>
          {summary.notSubmitted.length === 0 ? (
            <p className="mt-2 text-green-700">Everyone has submitted.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {summary.notSubmitted.map((worker) => (
                <li key={worker.id}>{worker.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
