"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // after log-in, the main page is different depending on the role. 
  // admin: list page, user: form page
  const nav =
    user.role === "admin"
      ? { href: "/list", label: "List" }
      : { href: "/form", label: "Form" };

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="bg-brand text-brand-contrast">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" className="font-semibold">
            RAS Safety Forms
          </Link>
          <Link href={nav.href} className="text-sm underline-offset-4 hover:underline">
            {nav.label}
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline">
            {user.firstName} {user.lastName}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-md border border-white/40 px-3 py-1.5 hover:bg-white/10"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
