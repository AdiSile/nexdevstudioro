// ============================================================
// NexusDevStudio.ro — NextAuth API Route Handler
// ============================================================
//
// Dynamic catch-all route for NextAuth.js v4 endpoints:
//   POST /api/auth/callback/credentials   — sign in
//   POST /api/auth/signout                — sign out
//   GET  /api/auth/session                — get session
//   GET  /api/auth/csrf                   — CSRF token
//   GET  /api/auth/providers              — list providers
//   GET  /api/auth/signin                 — sign-in page
//   GET  /api/auth/error                  — error page
//   GET  /api/auth/verify-request         — email verification
//
// Dependencies:
//   next-auth ^4.24
//   src/lib/auth/nextauth-config.ts — centralized authOptions

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-config";

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

/**
 * NextAuth initializes a catch-all handler from the authOptions.
 * We re-export the same handler for both GET and POST — NextAuth
 * internally routes to the correct endpoint based on the path + method.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
