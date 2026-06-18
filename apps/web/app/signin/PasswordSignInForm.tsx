"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { passwordSignIn } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn w-full justify-center" type="submit" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function PasswordSignInForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action] = useActionState(passwordSignIn, { error: null });
  return (
    <form action={action} className="flex flex-col gap-3">
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <label className="flex flex-col gap-1 text-sm">
        <span>Email</span>
        <input
          className="input w-full"
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Password</span>
        <input
          className="input w-full"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      {state.error ? (
        <p className="text-sm" style={{ color: "#f87171" }}>
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
