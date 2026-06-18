import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/auth";
import { getSessionUser } from "@/lib/authz";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAASregistry — submit your startup everywhere",
  description:
    "A curated catalog of 1,000+ startup-submission directories, plus a browser extension that pre-fills every form.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b" style={{ borderColor: "var(--border)" }}>
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm"
                style={{ background: "var(--accent-2)", color: "white" }}
              >
                ▲
              </span>
              <span>
                SAAS<span style={{ color: "var(--accent)" }}>registry</span>
              </span>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/directories" className="hover:underline">
                Directories
              </Link>
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <Link href="/extension" className="hover:underline">
                Extension
              </Link>
              {user ? (
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button className="hover:underline" type="submit">
                    Sign out
                  </button>
                </form>
              ) : (
                <Link href="/signin" className="hover:underline">
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer
          className="mx-auto mt-16 max-w-6xl px-4 py-8 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Directory metadata includes Ahrefs Domain Rating. Built for human-reviewed submissions —
          no auto-submitting bots.
        </footer>
      </body>
    </html>
  );
}
