"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mints an extension token against the user's web session and hands it back to the
 * extension by redirecting to its chromiumapp.org URL with the token in the hash.
 * Chrome's launchWebAuthFlow captures that redirect and closes this window.
 */
export function ConnectHandoff({ redirectUri }: { redirectUri: string }) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // guard against React 18 double-invoke
    started.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: "Chrome extension" }),
        });
        if (!res.ok) throw new Error(`Could not create a token (HTTP ${res.status}).`);
        const { token } = (await res.json()) as { token: string };
        window.location.replace(`${redirectUri}#token=${encodeURIComponent(token)}`);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [redirectUri]);

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="card p-6 text-sm" style={{ color: "var(--text-muted)" }}>
        {error ?? "Connecting the extension… this window will close automatically."}
      </div>
    </div>
  );
}
