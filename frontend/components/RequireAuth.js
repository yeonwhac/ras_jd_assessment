"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Header from "@/components/Header";

// only allow logged-in users to access the page. If not logged in, redirect to login page.
export default function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // check if the user is allowed to access the page based on their role
  const allowed = user && (!role || user.role === role);

  useEffect(() => {
    if (loading) return;                    // wait until loading is done
    if (!user) router.replace("/login");    // if not logged in, redirect to login page
    else if (!allowed) router.replace("/"); // if logged in but not allowed, redirect to main page
  }, [loading, user, allowed, router]);

  // show loading message while checking auth state or redirecting
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
