"use client";

import RequireAuth from "@/components/RequireAuth";
import MySubmissions from "@/components/MySubmissions";

export default function MyPage() {
  return (
    <RequireAuth role="framer">
      <h1 className="pt-6 text-2xl font-semibold">My submissions</h1>
      <MySubmissions />
    </RequireAuth>
  );
}
