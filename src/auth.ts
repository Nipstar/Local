/**
 * Auth.js (NextAuth v5) — passwordless magic-link sign-in (spec Phase 4).
 *
 * Database sessions via the Drizzle adapter. The verification email is sent
 * through our Brevo adapter, which logs the magic link to the console in mock
 * mode (no BREVO_API_KEY) so sign-in is testable in dev.
 */
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/db/schema";
import { SITE } from "@/lib/config";
import { sendTransactional } from "@/lib/integrations/brevo";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  trustHost: true,
  session: { strategy: "database" },
  pages: {
    signIn: "/portal/login",
    verifyRequest: "/portal/login?check=1",
  },
  callbacks: {
    // Expose the user id on the session (database strategy).
    session({ session, user }) {
      if (session.user && user) session.user.id = user.id;
      return session;
    },
  },
  providers: [
    {
      id: "brevo",
      type: "email",
      name: "Email",
      from: "hello@hantslocal.co.uk",
      maxAge: 24 * 60 * 60,
      options: {},
      async sendVerificationRequest({ identifier, url }) {
        await sendTransactional({
          to: { email: identifier },
          subject: `Sign in to ${SITE.name}`,
          html: `<p>Click to sign in to your ${SITE.name} portal:</p>
                 <p><a href="${url}">Sign in</a></p>
                 <p style="font-size:12px;color:#5A584F">If you didn't request this, ignore this email.</p>`,
          tags: ["auth:magic-link"],
        });
      },
    },
  ],
});
