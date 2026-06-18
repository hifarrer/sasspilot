import { compare, hash } from "bcryptjs";
import { z } from "zod";

// Shared validation for email/password forms (sign-up and sign-in).
export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters.");

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}
