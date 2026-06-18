"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { register } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn w-full justify-center" type="submit" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export function SignupForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action] = useActionState(register, { error: null });
  return (
    <form action={action} className="flex flex-col gap-3">
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <label className="flex flex-col gap-1 text-sm">
        <span>Name</span>
        <input className="input w-full" type="text" name="name" autoComplete="name" required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Email</span>
        <input className="input w-full" type="email" name="email" autoComplete="email" required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Password</span>
        <input
          className="input w-full"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          At least 8 characters.
        </span>
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
