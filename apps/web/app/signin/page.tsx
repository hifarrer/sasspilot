import { authConfigured, enabledProviders, signIn } from "@/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // Only allow internal redirects, so this can't become an open redirect.
  const redirectTo = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard";
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-12">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Sign in to save startup profiles and track your submissions.
      </p>

      {!authConfigured ? (
        <div className="card p-6 text-sm" style={{ color: "var(--text-muted)" }}>
          OAuth isn&apos;t configured yet. Add <code>AUTH_GITHUB_ID</code> /{" "}
          <code>AUTH_GITHUB_SECRET</code> (or the Google equivalents) to{" "}
          <code>apps/web/.env.local</code> and restart the dev server.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {enabledProviders.github && (
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo });
              }}
            >
              <button className="btn w-full justify-center" type="submit">
                Continue with GitHub
              </button>
            </form>
          )}
          {enabledProviders.google && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo });
              }}
            >
              <button className="btn w-full justify-center" type="submit">
                Continue with Google
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
