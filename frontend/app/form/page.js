"use client";

import RequireAuth from "@/components/RequireAuth";

export default function FormPage() {
  return (
    <RequireAuth role="framer">
      <h1 className="py-6 text-2xl font-semibold">Safety form</h1>
      <p className="text-zinc-600">The form fields are added in the next step.</p>
    </RequireAuth>
  );
}
