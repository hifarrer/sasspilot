import type { Metadata } from "next";
import Link from "next/link";
import { authConfigured } from "@/auth";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Create account — SAASregistry",
  description:
    "Create a SAASregistry account to save startup profiles and track your directory submissions.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const signinHref = callbackUrl
    ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/signin";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm"
            style={{ background: "var(--accent-2)", color: "white" }}
          >
            ▲
          </span>
          <span>
            SAAS<span style={{ color: "var(--accent)" }}>registry</span>
          </span>
        </Link>
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          One profile, filled across 1,000+ startup directories. Free to start.
        </p>
      </div>

      {!authConfigured ? (
        <div className="card p-6 text-sm" style={{ color: "var(--text-muted)" }}>
          Sign-up isn&apos;t configured yet. Set <code>AUTH_SECRET</code> in{" "}
          <code>apps/web/.env.local</code> and restart the dev server.
        </div>
      ) : (
        <div className="card flex flex-col gap-4 p-6">
          <SignupForm callbackUrl={callbackUrl} />
          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            🔒 Passwords are hashed and never stored in plain text.
          </p>
        </div>
      )}

      <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link href={signinHref} className="underline" style={{ color: "var(--accent)" }}>
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline" style={{ color: "var(--accent)" }}>
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline" style={{ color: "var(--accent)" }}>
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
