import type { Metadata } from "next";
import Link from "next/link";
import { authConfigured, enabledProviders, signIn } from "@/auth";
import { PasswordSignInForm } from "./PasswordSignInForm";

export const metadata: Metadata = {
  title: "Sign in — SAASregistry",
  description:
    "Sign in to SAASregistry to save startup profiles and track your directory submissions.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // Only allow internal redirects, so this can't become an open redirect.
  const redirectTo = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard";
  const signupHref = callbackUrl
    ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/signup";

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
        <h1 className="text-2xl font-bold">Sign in to your account</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Save startup profiles, sync them to the browser extension, and track every directory
          submission in one dashboard.
        </p>
      </div>

      {!authConfigured ? (
        <div className="card p-6 text-sm" style={{ color: "var(--text-muted)" }}>
          Sign-in isn&apos;t configured yet. Set <code>AUTH_SECRET</code> in{" "}
          <code>apps/web/.env.local</code> and restart the dev server.
        </div>
      ) : (
        <div className="card flex flex-col gap-4 p-6">
          <PasswordSignInForm callbackUrl={callbackUrl} />

          {enabledProviders.github && (
            <>
              <div
                className="flex items-center gap-3 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                or
                <span className="h-px flex-1" style={{ background: "var(--border)" }} />
              </div>
              <form
                action={async () => {
                  "use server";
                  await signIn("github", { redirectTo });
                }}
              >
                <button className="btn btn-ghost w-full justify-center" type="submit">
                  Continue with GitHub
                </button>
              </form>
            </>
          )}

          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            🔒 Passwords are hashed and never stored in plain text.
          </p>
        </div>
      )}

      <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Don&apos;t have an account?{" "}
        <Link href={signupHref} className="underline" style={{ color: "var(--accent)" }}>
          Create one
        </Link>
      </p>

      <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
        By continuing you agree to our{" "}
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
