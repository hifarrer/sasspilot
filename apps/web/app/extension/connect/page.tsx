import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/authz";
import { ConnectHandoff } from "./ConnectHandoff";

export const dynamic = "force-dynamic";

// Chrome's launchWebAuthFlow redirect URL: https://<32-char-id>.chromiumapp.org/
const REDIRECT_RE = /^https:\/\/[a-z0-9]{32}\.chromiumapp\.org\/?$/i;

export default async function ExtensionConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_uri?: string }>;
}) {
  const { redirect_uri: redirectUri } = await searchParams;
  const valid = !!redirectUri && REDIRECT_RE.test(redirectUri);

  // Require a web session; bounce through sign-in and return here afterwards.
  const user = await getSessionUser();
  if (!user) {
    const self = `/extension/connect${
      redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : ""
    }`;
    redirect(`/signin?callbackUrl=${encodeURIComponent(self)}`);
  }

  if (!valid) {
    return (
      <div className="mx-auto max-w-md py-12">
        <div className="card p-6 text-sm" style={{ color: "var(--text-muted)" }}>
          This page is opened by the browser extension. The redirect target was missing or invalid —
          start sign-in from the extension&apos;s <strong>Sign in</strong> button.
        </div>
      </div>
    );
  }

  return <ConnectHandoff redirectUri={redirectUri!} />;
}
