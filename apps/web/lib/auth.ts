import { db } from "@doujin/database";
import * as schema from "@doujin/database/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret:
    process.env.BETTER_AUTH_SECRET || "default-secret-change-in-production",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`Magic link for ${user.email}: ${url}`);
      // TODO: Integrate with email service (SendGrid, Resend, etc.)
    },
    sendOnSignUp: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
});

export type Session = typeof auth.$Infer.Session;
