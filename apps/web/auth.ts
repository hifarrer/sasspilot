import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

// Only enable providers that have credentials configured, so the app still runs
// (browse-only) before OAuth is set up.
const providers: NextAuthConfig["providers"] = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);

export const enabledProviders = {
  github: !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
};
export const authConfigured = providers.length > 0;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers,
  pages: { signIn: "/signin" },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
