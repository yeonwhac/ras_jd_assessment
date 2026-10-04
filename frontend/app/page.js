"use client";

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";

function Landing() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Hi, {user.firstName}</h1>
        <p className="mt-1 text-zinc-600">
          {isAdmin
            ? "Review the safety forms submitted on each site."
            : "Fill out your safety form before you start work."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href={isAdmin ? "/list" : "/form"}
          className="flex h-14 items-center justify-center rounded-md bg-brand text-lg font-medium text-brand-contrast"
        >
          {isAdmin ? "Open List" : "Open Form"}
        </Link>
        {!isAdmin && (
          <Link
            href="/my"
            className="flex h-12 items-center justify-center rounded-md border border-brand text-base font-medium text-brand"
          >
            My submissions
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <RequireAuth>
      <Landing />
    </RequireAuth>
  );
}
