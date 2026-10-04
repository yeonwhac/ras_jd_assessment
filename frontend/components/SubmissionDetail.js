"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { CHECKLIST_GROUPS } from "@/lib/checklist";
import { formatDate, formatDateTime } from "@/lib/format";
import { loadListQuery } from "@/lib/listQuery";
import StatusBadge from "@/components/StatusBadge";

export default function SubmissionDetail() {
  const { id } = useParams(); // the [id] part of /list/[id]
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user.role === "admin";

  const [submission, setSubmission] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch(`/api/submissions/${id}`);
        if (!cancelled) setSubmission(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // An admin goes back to the list with the filters they had (remembered for this tab, plain /list if none).
  // A framer goes back to their own list.
  function goBack() {
    if (!isAdmin) return router.push("/my");
    const query = loadListQuery();
    router.push(query ? `/list?${query}` : "/list");
  }

  async function changeStatus(status) {
    setSaving(true);
    setActionError("");
    try {
      const data = await apiFetch(`/api/submissions/${id}`, { method: "PATCH", body: { status } });
      setSubmission((prev) => ({ ...prev, status: data.status }));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const backButton = (
    <button type="button" onClick={goBack} className="mt-6 rounded px-1 py-1 text-sm text-zinc-600 underline underline-offset-4">
      {isAdmin ? "← Back to list" : "← Back to my submissions"}
    </button>
  );

  if (error) {
    return (
      <div>
        {backButton}
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      </div>
    );
  }
  if (!submission) return <p className="py-6 text-zinc-500">Loading…</p>;

  const noCount = Object.values(submission.checklist).filter((answer) => answer === false).length;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        {backButton}
        <h1 className="mt-3 text-2xl font-semibold">{submission.site.name}</h1>
        <p className="mt-1 text-zinc-700">
          {submission.worker.name} · {formatDate(submission.workDate)}
        </p>
        <p className="text-sm text-zinc-500">Submitted {formatDateTime(submission.createdAt)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={submission.status} />
        {/* Only admins can change the status; a framer just sees it */}
        {isAdmin && submission.status === "submitted" && (
          <button
            type="button"
            onClick={() => changeStatus("reviewed")}
            disabled={saving}
            className="h-10 rounded-md bg-brand px-4 text-brand-contrast disabled:opacity-60"
          >
            {saving ? "Saving…" : "Mark as reviewed"}
          </button>
        )}
        {isAdmin && submission.status === "reviewed" && (
          <button
            type="button"
            onClick={() => changeStatus("submitted")}
            disabled={saving}
            className="rounded px-2 py-2 text-sm text-zinc-600 underline underline-offset-4 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Undo review"}
          </button>
        )}
      </div>
      {actionError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {noCount > 0 ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-red-800">
          {noCount} check{noCount === 1 ? "" : "s"} answered No.
        </p>
      ) : (
        <p className="rounded-md bg-green-50 px-4 py-3 text-green-800">All checks answered Yes.</p>
      )}

      {CHECKLIST_GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 px-4">
            {group.items.map((item) => {
              const answer = submission.checklist[item.key];
              return (
                <li key={item.key} className="flex items-center justify-between gap-3 py-3">
                  <span>{item.label}</span>
                  <span
                    className={`w-14 rounded-full py-0.5 text-center text-sm ${
                      answer ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {answer ? "Yes" : "No"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Hazards identified</h2>
        {submission.hazards.length === 0 ? (
          <p className="text-zinc-600">None.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {submission.hazards.map((hazard) => (
              <li key={hazard} className="rounded-full border border-accent bg-accent/15 px-4 py-1.5">
                {hazard}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Notes</h2>
        {submission.notes ? (
          <p className="whitespace-pre-wrap rounded-md border border-zinc-200 px-4 py-3">{submission.notes}</p>
        ) : (
          <p className="text-zinc-600">No notes.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Photos</h2>
        {submission.photos.length === 0 ? (
          <p className="text-zinc-600">No photos.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {submission.photos.map((photo) => (
              <li key={photo.id}>
                {photo.url ? (
                  <a
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square overflow-hidden rounded-md border border-zinc-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.name || "Submission photo"}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-zinc-300 px-2 text-center text-sm text-zinc-500">
                    Photo unavailable
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-zinc-500">Photo links expire after one hour. Reload the page for fresh ones.</p>
      </section>
    </div>
  );
}
