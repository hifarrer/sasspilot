"use server";

import { Prisma } from "@prisma/client";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { emailSchema, hashPassword, passwordSchema } from "@/lib/password";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: emailSchema,
  password: passwordSchema,
});

function safeRedirect(callbackUrl: unknown): string {
  return typeof callbackUrl === "string" && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
}

const EXISTS = "An account with this email already exists. Try signing in instead.";

export async function register(_prev: { error: string | null }, formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: EXISTS };

  try {
    await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: EXISTS };
    }
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: safeRedirect(formData.get("callbackUrl")) });
  } catch (error) {
    // A successful sign-in throws a redirect, which must be re-thrown.
    if (error instanceof AuthError) {
      return { error: "Account created. Please sign in." };
    }
    throw error;
  }
  return { error: null };
}
