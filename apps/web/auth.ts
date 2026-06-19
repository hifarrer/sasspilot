import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { credentialsSchema, verifyPassword } from "@/lib/password";

// Temporarily disabled while the domain is under Safe Browsing review — flip back
// to re-enable the "Continue with Google" button (and route).
const GOOGLE_LOGIN_ENABLED = false;

// Email/password is always available. OAuth providers are added only when their
// credentials are configured, so the app still runs (browse-only) before setup.
const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Email and password",
    credentials: { email: {}, password: {} },
    authorize: async (raw) => {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;
      const user = await db.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return null;
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (GOOGLE_LOGIN_ENABLED && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

export const enabledProviders = {
  credentials: true,
  github: !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  google: GOOGLE_LOGIN_ENABLED && !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
};
export const authConfigured = providers.length > 0;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // Running behind Railway's proxy, the forwarded Host header isn't trusted by
  // default (Auth.js throws UntrustedHost). Trust it so callbacks resolve.
  trustHost: true,
  // Credentials sign-in requires JWT sessions (it can't persist a DB session).
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/signin" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") session.user.id = token.id;
      return session;
    },
  },
});
