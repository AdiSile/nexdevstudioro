// ============================================================
// NexusDevStudio.ro — NextAuth Configuration
// CredentialProvider + Prisma Adapter + JWT Strategy
// ============================================================
//
// Authentication pipeline:
//   1. User submits email + password
//   2. authorize() looks up user by email via Prisma
//   3. Validates account status (ACTIVE), lockout (lockedUntil)
//   4. Verifies password hash (argon2 → bcryptjs fallback)
//   5. Updates lastLoginAt, lastLoginIp, resets failedLoginAttempts
//   6. Issues JWT with enriched claims (role, organization)
//   7. session callback hydrates the session object for the client
//
// Environment Variables:
//   NEXTAUTH_SECRET — HS512 signing key (required, 64+ chars)
//   NEXTAUTH_URL    — canonical base URL (e.g. https://nexusdevstudio.ro)
//
// Dependencies:
//   next-auth ^4.24
//   @next-auth/prisma-adapter ^1.0
//   argon2 ^0.41
//   bcryptjs ^2.4 (fallback for legacy password hashes)

import { type AuthOptions, type User, type Session } from "next-auth";
import { type JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import * as argon2 from "argon2";
import { compare as bcryptCompare } from "bcryptjs";

import { getPrismaClient } from "@/lib/prisma";
import { createComponentLogger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const log = createComponentLogger("nextauth");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum failed login attempts before account lockout */
const MAX_FAILED_ATTEMPTS = 5;

/** Lockout duration in minutes */
const LOCKOUT_MINUTES = 15;

/** Default session max age: 30 days */
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** JWT cookie name */
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

// ---------------------------------------------------------------------------
// Type Augmentations
// ---------------------------------------------------------------------------

/** Additional fields stored in the JWT token */
export interface ExtendedJWT extends JWT {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  organizationId: string | null;
  organizationSlug: string | null;
  organizationName: string | null;
  roleId: string | null;
  roleSlug: string | null;
  roleLevel: number;
  status: string;
  locale: string;
  theme: string;
}

/** Additional fields exposed on the client session */
export interface ExtendedSession extends Session {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    organizationId: string | null;
    organizationSlug: string | null;
    organizationName: string | null;
    roleId: string | null;
    roleSlug: string | null;
    roleLevel: number;
    status: string;
    locale: string;
    theme: string;
  };
  expires: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt password verification against both argon2 and bcryptjs.
 * Argon2id is the primary algorithm; bcryptjs is a fallback for
 * legacy hashes that have not been upgraded yet.
 */
async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<{ verified: boolean; needsRehash: boolean }> {
  // 1) Try argon2id (primary modern hashing)
  try {
    const argon2Verified = await argon2.verify(hash, plaintext);
    if (argon2Verified) {
      return { verified: true, needsRehash: false };
    }
  } catch {
    // Hash is not valid argon2 — fall through to bcrypt
  }

  // 2) Fallback: bcryptjs for legacy hashes ($2a$, $2b$, $2y$)
  if (hash.startsWith("$2")) {
    try {
      const bcryptVerified = await bcryptCompare(plaintext, hash);
      if (bcryptVerified) {
        // Signal that this password should be upgraded to argon2
        return { verified: true, needsRehash: true };
      }
    } catch {
      // Both attempts failed
    }
  }

  return { verified: false, needsRehash: false };
}

/**
 * Rehash a password with argon2id and persist.
 * Called transparently when a legacy bcrypt hash is encountered.
 */
async function upgradePasswordHash(
  userId: string,
  plaintext: string,
): Promise<void> {
  try {
    const prisma = getPrismaClient();
    const newHash = await argon2.hash(plaintext, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MiB (OWASP 2024 recommendation)
      timeCost: 3,       // 3 iterations
      parallelism: 2,    // 2 lanes
      hashLength: 32,
    });

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    log.info("Password hash upgraded to argon2id", { userId });
  } catch (err) {
    // Non-fatal: auth succeeded even if upgrade fails
    log.warn("Password hash upgrade failed — auth continues", {
      userId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

/**
 * Check if the user account is locked due to too many failed attempts.
 * Returns true if the account can proceed; false if still locked.
 */
function isAccountLocked(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false;
  return new Date() < lockedUntil;
}

// ---------------------------------------------------------------------------
// NextAuth Configuration
// ---------------------------------------------------------------------------

export const authOptions: AuthOptions = {
  // ── Adapter ─────────────────────────────────────────────────
  adapter: PrismaAdapter(getPrismaClient()),

  // ── Session Strategy ────────────────────────────────────────
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },

  // ── JWT ─────────────────────────────────────────────────────
  jwt: {
    // Let NextAuth manage signing with NEXTAUTH_SECRET (HS512)
    maxAge: SESSION_MAX_AGE_SECONDS,
  },

  // ── Cookies ─────────────────────────────────────────────────
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Host-next-auth.csrf-token"
          : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  // ── Pages ───────────────────────────────────────────────────
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
    newUser: "/onboarding",
  },

  // ── Providers ───────────────────────────────────────────────
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",

      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "nume@companie.ro",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(
        credentials: Record<"email" | "password", string> | undefined,
        _req,
      ): Promise<User | null> {
        // -----------------------------------------------------------------
        // 1. Validate input presence
        // -----------------------------------------------------------------
        if (!credentials?.email || !credentials?.password) {
          log.warn("Missing credentials", {
            hasEmail: !!credentials?.email,
            hasPassword: !!credentials?.password,
          });
          return null;
        }

        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password;

        // Basic email format validation (guard against empty / egregious)
        if (!email.includes("@") || email.length > 320) {
          log.warn("Invalid email format rejected", { email: email.slice(0, 40) });
          return null;
        }

        // Reject empty password early
        if (password.length === 0) {
          log.warn("Empty password rejected", { email: email.slice(0, 40) });
          return null;
        }

        const prisma = getPrismaClient();

        // -----------------------------------------------------------------
        // 2. Look up user by email
        // -----------------------------------------------------------------
        let dbUser;
        try {
          dbUser = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              passwordHash: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              locale: true,
              theme: true,
              failedLoginAttempts: true,
              lockedUntil: true,
              emailVerified: true,
              organizationId: true,
              defaultRoleId: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                },
              },
              defaultRole: {
                select: {
                  id: true,
                  slug: true,
                  level: true,
                },
              },
            },
          });
        } catch (err) {
          log.error("Database lookup failed during auth", {
            email: email.slice(0, 40),
            error: err instanceof Error ? err.message : "unknown",
          });
          return null;
        }

        // -----------------------------------------------------------------
        // 3. Constant-time-ish: if user doesn't exist, waste similar time
        //    to prevent user enumeration via timing
        // -----------------------------------------------------------------
        if (!dbUser || !dbUser.passwordHash) {
          // Dummy hash verification to create constant-time response
          // against user enumeration attacks
          const dummyHash =
            "$argon2id$v=19$m=65536,t=3,p=2$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
          await argon2.verify(dummyHash, password).catch(() => {});
          log.info("Auth failed: user not found or no password set", {
            email: email.slice(0, 40),
          });
          return null;
        }

        // -----------------------------------------------------------------
        // 4. Check user status
        // -----------------------------------------------------------------
        if (dbUser.status !== "ACTIVE") {
          // Still run hash verification to prevent enumeration
          await argon2.verify(dbUser.passwordHash, password).catch(() => {});

          log.warn("Auth rejected: user not ACTIVE", {
            userId: dbUser.id,
            status: dbUser.status,
          });
          return null;
        }

        // -----------------------------------------------------------------
        // 5. Check organization status (if user belongs to an org)
        // -----------------------------------------------------------------
        if (
          dbUser.organization &&
          dbUser.organization.status !== "ACTIVE" &&
          dbUser.organization.status !== "TRIAL" &&
          dbUser.organization.status !== "GRACE_PERIOD"
        ) {
          log.warn("Auth rejected: organization not active", {
            userId: dbUser.id,
            organizationId: dbUser.organization.id,
            organizationStatus: dbUser.organization.status,
          });
          return null;
        }

        // -----------------------------------------------------------------
        // 6. Check account lockout
        // -----------------------------------------------------------------
        if (isAccountLocked(dbUser.lockedUntil as Date | null)) {
          const remainingMs =
            new Date(dbUser.lockedUntil as Date).getTime() - Date.now();
          log.warn("Auth rejected: account locked", {
            userId: dbUser.id,
            lockedUntil: dbUser.lockedUntil,
            remainingMinutes: Math.ceil(remainingMs / 60_000),
          });
          return null;
        }

        // -----------------------------------------------------------------
        // 7. Verify password
        // -----------------------------------------------------------------
        const { verified, needsRehash } = await verifyPassword(
          password,
          dbUser.passwordHash,
        );

        if (!verified) {
          // Increment failed attempts
          const newFailedAttempts = dbUser.failedLoginAttempts + 1;
          const updates: Record<string, unknown> = {
            failedLoginAttempts: newFailedAttempts,
          };

          // Lock account if threshold reached
          if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
            updates.lockedUntil = new Date(
              Date.now() + LOCKOUT_MINUTES * 60 * 1000,
            );
          }

          try {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: updates,
            });
          } catch (err) {
            log.error("Failed to update failed login attempts", {
              userId: dbUser.id,
              error: err instanceof Error ? err.message : "unknown",
            });
          }

          log.warn("Auth failed: invalid password", {
            userId: dbUser.id,
            failedAttempts: newFailedAttempts,
            locked:
              newFailedAttempts >= MAX_FAILED_ATTEMPTS,
          });
          return null;
        }

        // -----------------------------------------------------------------
        // 8. Authentication successful — update login metadata
        // -----------------------------------------------------------------
        try {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              lastLoginAt: new Date(),
              lastLoginIp:
                (_req?.headers?.["x-forwarded-for"] as string)?.split(
                  ",",
                )[0]?.trim() ||
                (_req?.headers?.["x-real-ip"] as string) ||
                null,
              failedLoginAttempts: 0,
              lockedUntil: null,
            },
          });
        } catch (err) {
          // Non-fatal: auth will still succeed
          log.warn("Failed to update login metadata", {
            userId: dbUser.id,
            error: err instanceof Error ? err.message : "unknown",
          });
        }

        // -----------------------------------------------------------------
        // 9. Transparent password hash upgrade (bcrypt → argon2id)
        // -----------------------------------------------------------------
        if (needsRehash) {
          await upgradePasswordHash(dbUser.id, password);
        }

        // -----------------------------------------------------------------
        // 10. Build and return the NextAuth User object
        // -----------------------------------------------------------------
        const user: User = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.displayName || dbUser.firstName || dbUser.email,
          image: dbUser.avatarUrl,
        };

        log.info("Auth succeeded", {
          userId: dbUser.id,
          organizationId: dbUser.organizationId,
        });

        return user;
      },
    }),

    // ── Future providers (OAuth) can be added here ──────────────
    // GoogleProvider({ ... }),
    // GitHubProvider({ ... }),
  ],

  // ── Callbacks ──────────────────────────────────────────────

  callbacks: {
    /**
     * JWT callback — enriches the token with user metadata on sign in
     * and on subsequent token refreshes.
     */
    async jwt({ token, user, trigger, session }) {
      // On initial sign in, hydrate the token from the database
      if (user) {
        const prisma = getPrismaClient();

        try {
          const enriched = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              locale: true,
              theme: true,
              organizationId: true,
              defaultRoleId: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              defaultRole: {
                select: {
                  id: true,
                  slug: true,
                  level: true,
                },
              },
            },
          });

          if (enriched) {
            token.id = enriched.id;
            token.email = enriched.email;
            token.displayName = enriched.displayName;
            token.avatarUrl = enriched.avatarUrl;
            token.status = enriched.status;
            token.locale = enriched.locale || "ro";
            token.theme = enriched.theme || "system";
            token.organizationId = enriched.organizationId;
            token.organizationSlug = enriched.organization?.slug ?? null;
            token.organizationName = enriched.organization?.name ?? null;
            token.roleId = enriched.defaultRole?.id ?? null;
            token.roleSlug = enriched.defaultRole?.slug ?? null;
            token.roleLevel = enriched.defaultRole?.level ?? 0;
          }
        } catch (err) {
          log.error("Failed to enrich JWT on sign in", {
            userId: user.id,
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      }

      // Handle session update trigger (e.g., user changes theme/locale)
      if (trigger === "update" && session) {
        const updates = session as Partial<ExtendedJWT>;
        if (updates.displayName !== undefined) token.displayName = updates.displayName;
        if (updates.avatarUrl !== undefined) token.avatarUrl = updates.avatarUrl;
        if (updates.locale !== undefined) token.locale = updates.locale;
        if (updates.theme !== undefined) token.theme = updates.theme;
        if (updates.organizationId !== undefined) token.organizationId = updates.organizationId;
        if (updates.roleId !== undefined) token.roleId = updates.roleId;
        if (updates.roleSlug !== undefined) token.roleSlug = updates.roleSlug;
        if (updates.roleLevel !== undefined) token.roleLevel = updates.roleLevel;
      }

      return token;
    },

    /**
     * Session callback — maps the JWT token claims to the session object
     * exposed to the client via `useSession()` / `getServerSession()`.
     */
    async session({ session, token }) {
      const extToken = token as ExtendedJWT;

      session.user = {
        id: extToken.id,
        email: extToken.email,
        displayName: extToken.displayName,
        avatarUrl: extToken.avatarUrl,
        organizationId: extToken.organizationId,
        organizationSlug: extToken.organizationSlug,
        organizationName: extToken.organizationName,
        roleId: extToken.roleId,
        roleSlug: extToken.roleSlug,
        roleLevel: extToken.roleLevel,
        status: extToken.status,
        locale: extToken.locale,
        theme: extToken.theme,
      };

      session.expires = new Date(
        Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
      ).toISOString();

      return session;
    },

    /**
     * Sign-in redirect callback.
     * Redirects to dashboard by default; respects callbackUrl when safe.
     */
    async redirect({ url, baseUrl }) {
      // Relative URLs are safe; redirect to them
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      // Same-origin URLs are safe
      if (new URL(url).origin === baseUrl) return url;

      // External URLs are unsafe — fall back to dashboard
      return `${baseUrl}/dashboard`;
    },
  },

  // ── Events ─────────────────────────────────────────────────

  events: {
    /**
     * signIn event — logged for audit trail.
     */
    async signIn({ user, isNewUser }) {
      log.info("Sign-in event", {
        userId: user.id,
        isNewUser,
      });

      if (isNewUser) {
        log.info("New user registered via OAuth / provider", {
          userId: user.id,
          email: user.email,
        });
      }
    },

    /**
     * signOut event — logged for audit trail.
     */
    async signOut({ token }) {
      const extToken = token as ExtendedJWT | null;
      log.info("Sign-out event", {
        userId: extToken?.id ?? "unknown",
      });
    },

    /**
     * createUser event — logged when PrismaAdapter creates a user.
     */
    async createUser({ user }) {
      log.info("User created via adapter", {
        userId: user.id,
        email: user.email,
      });
    },

    /**
     * linkAccount event — logged when an OAuth account is linked.
     */
    async linkAccount({ user, account }) {
      log.info("OAuth account linked", {
        userId: user.id,
        provider: account.provider,
      });
    },

    /**
     * session event — trace-level logging for session activity.
     */
    async session({ session }) {
      const extSession = session as ExtendedSession;
      log.debug("Session accessed", {
        userId: extSession.user?.id ?? "unknown",
      });
    },
  },

  // ── Secret ─────────────────────────────────────────────────
  secret: process.env.NEXTAUTH_SECRET,

  // ── Debug ───────────────────────────────────────────────────
  debug: process.env.NODE_ENV !== "production",
};

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

export default authOptions;