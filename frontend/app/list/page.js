"use client";

import RequireAuth from "@/components/RequireAuth";
import SummaryPanel from "@/components/SummaryPanel";
import SubmissionList from "@/components/SubmissionList";

export default function ListPage() {
  return (
    <RequireAuth role="admin">
      <h1 className="pt-6 text-2xl font-semibold">Submissions</h1>
      <SummaryPanel />
      <SubmissionList />
    </RequireAuth>
  );
}
