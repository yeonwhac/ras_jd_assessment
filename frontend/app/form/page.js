"use client";

import RequireAuth from "@/components/RequireAuth";
import SafetyForm from "@/components/SafetyForm";

export default function FormPage() {
  return (
    <RequireAuth role="framer">
      <h1 className="pt-6 text-2xl font-semibold">Safety form</h1>
      <SafetyForm />
    </RequireAuth>
  );
}
