"use client";

import RequireAuth from "@/components/RequireAuth";
import SubmissionDetail from "@/components/SubmissionDetail";

export default function MySubmissionDetailPage() {
  return (
    <RequireAuth role="framer">
      <SubmissionDetail />
    </RequireAuth>
  );
}
