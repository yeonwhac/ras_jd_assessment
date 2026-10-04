"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";

// The logged-in framer's own submissions, newest first
export default function MySubmissions() {
  const [submissions, setSubmissions] = useState(null); // null until loaded
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch("/api/submissions/mine");
        if (!cancelled) setSubmissions(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (!submissions) return <p className="py-6 text-zinc-500">Loading…</p>;

  if (submissions.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-zinc-200 px-4 py-8 text-center">
        <p className="text-zinc-600">You have not submitted any forms yet.</p>
        <Link href="/form" className="mt-3 inline-block text-brand underline underline-offset-4">
          Fill out a safety form
        </Link>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 py-4">
      <p className="text-sm text-zinc-600">
        {submissions.length} submission{submissions.length === 1 ? "" : "s"}
      </p>
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-md border border-zinc-200">
        {submissions.map((row) => (
          <li key={row.id}>
            <Link
              href={`/my/${row.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-50"
            >
              <span className="min-w-36 flex-1 font-medium">{row.site.name}</span>
              <span className="w-28 text-zinc-700">{formatDate(row.workDate)}</span>
              <span className="w-20 text-sm text-zinc-500">
                {row.photoCount} photo{row.photoCount === 1 ? "" : "s"}
              </span>
              <StatusBadge status={row.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
