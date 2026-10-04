"use client";

import RequireAuth from "@/components/RequireAuth";
import SubmissionDetail from "@/components/SubmissionDetail";

export default function SubmissionDetailPage() {
  return (
    <RequireAuth role="admin">
      <SubmissionDetail />
    </RequireAuth>
  );
}
