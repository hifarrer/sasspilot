"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { credentialsSchema } from "@/lib/password";

function safeRedirect(callbackUrl: unknown): string {
  return typeof callbackUrl === "string" && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
}

export async function passwordSignIn(_prev: { error: string | null }, formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (error) {
    // A successful sign-in throws a redirect, which must be re-thrown.
    if (error instanceof AuthError) return { error: "Invalid email or password." };
    throw error;
  }
  return { error: null };
}
