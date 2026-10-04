"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

// Menu items for each role
const NAV_BY_ROLE = {
  admin: [{ href: "/list", label: "List" }],
  framer: [
    { href: "/form", label: "Form" },
    { href: "/my", label: "My submissions" },
  ],
};

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="border-b-4 border-brand bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-5 gap-y-1 px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/" aria-label="RAS Safety Forms home">
            <Image src="/logo.png" alt="RAS Framing & Formwork" width={288} height={232} priority className="h-11 w-auto" />
          </Link>
          <nav className="flex items-center gap-4">
            {(NAV_BY_ROLE[user.role] ?? []).map((item) => {
              // The page you are on is highlighted (also for its sub-pages, e.g. /list/12 under /list)
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`py-2 text-brand underline-offset-8 hover:underline ${active ? "font-semibold underline" : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-zinc-600 sm:inline">
            {user.firstName} {user.lastName}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-md border border-brand px-3 py-1.5 text-brand hover:bg-brand/10"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
