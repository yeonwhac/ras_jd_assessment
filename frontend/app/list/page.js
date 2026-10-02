"use client";

import RequireAuth from "@/components/RequireAuth";

export default function ListPage() {
  return (
    <RequireAuth role="admin">
      <h1 className="py-6 text-2xl font-semibold">Submissions</h1>
      <p className="text-zinc-600">The submission list by site is added in the next step.</p>
    </RequireAuth>
  );
}
