"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Header from "@/components/Header";

// only allow logged-in users to access the page. If not logged in, redirect to login page.
export default function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const allowed = user && (!role || user.role === role);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!allowed) router.replace("/");
  }, [loading, user, allowed, router]);

  if (loading || !allowed) {
    return <p className="p-6 text-zinc-500">Loading…</p>;
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">{children}</main>
    </>
  );
}
