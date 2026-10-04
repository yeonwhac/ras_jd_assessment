"use client";

import { Suspense } from "react";
import RequireAuth from "@/components/RequireAuth";
import SummaryPanel from "@/components/SummaryPanel";
import SubmissionList from "@/components/SubmissionList";

export default function ListPage() {
  return (
    <RequireAuth role="admin">
      <h1 className="pt-6 text-2xl font-semibold">Submissions</h1>
      <SummaryPanel />
      {/* SubmissionList reads the URL (useSearchParams), which Next requires to be inside a Suspense boundary */}
      <Suspense fallback={<p className="py-6 text-zinc-500">Loading…</p>}>
        <SubmissionList />
      </Suspense>
    </RequireAuth>
  );
}
