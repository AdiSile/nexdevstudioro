// ============================================================
// NexusDevStudio.ro — useAuth Hook
// ============================================================
//
// Convenience hook that wraps next-auth's `useSession` and exposes
// enriched authentication state: session, user, status, role-level
// helpers, and permission guards.
//
// This hook MUST be used inside <AuthProvider> (which wraps the
// application root in the layout).  It automatically infers the
// extended session shape defined in nextauth-config.ts.
//
// Usage:
//
//   import { useAuth } from "@/hooks/useAuth";
//
//   function DashboardPage() {
//     const { user, isAuthenticated, isLoading, isAdmin } = useAuth();
//
//     if (isLoading) return <Spinner />;
//     if (!isAuthenticated) return <Redirect to="/auth/signin" />;
//
//     return <h1>Welcome, {user.displayName}!</h1>;
//   }
//
// Dependencies:
//   next-auth ^4.24
//   @/providers/AuthProvider (SessionProvider wrapper)
//   @/lib/auth/nextauth-config (ExtendedSession type)

"use client";

import { useSession } from "@/providers/AuthProvider";
import type { ExtendedSession } from "@/lib/auth/nextauth-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Strongly-typed user object extracted from the extended session */
export interface AuthUser {
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

/** Return type of the useAuth hook */
export interface UseAuthReturn {
  /** The full next-auth session (or null when unauthenticated / loading) */
  session: ExtendedSession | null;
  /** Strongly-typed user object (null when unauthenticated) */
  user: AuthUser | null;
  /** NextAuth session status: "loading" | "authenticated" | "unauthenticated" */
  status: "loading" | "authenticated" | "unauthenticated";
  /** True while the session is being fetched / validated */
  isLoading: boolean;
  /** True when the user is fully authenticated */
  isAuthenticated: boolean;
  /** True when the user is definitely not authenticated (not loading) */
  isUnauthenticated: boolean;
  /** NextAuth update() — trigger a session refresh or partial update */
  update: (data?: Partial<Record<string, unknown>>) => Promise<unknown>;
  /** True when roleLevel ≥ 100 (administrator / super-admin) */
  isAdmin: boolean;
  /** True when roleLevel ≥ 50 (manager or higher) */
  isManager: boolean;
  /** True when roleLevel ≥ 20 (editor or higher) */
  isEditor: boolean;
  /** True when the user belongs to an organization */
  hasOrganization: boolean;
  /** Shorthand: can access admin dashboard / features */
  canAccessAdmin: boolean;
  /** Shorthand: can manage organization settings */
  canManageOrganization: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Role-level thresholds (mirrors the project's RBAC conventions) */
const ROLE_LEVEL = {
  ADMIN: 100,
  MANAGER: 50,
  EDITOR: 20,
} as const;

// ---------------------------------------------------------------------------
// useAuth Hook
// ---------------------------------------------------------------------------

/**
 * Primary authentication hook for client components.
 *
 * Wraps `useSession()` from next-auth/react (exposed through the project's
 * AuthProvider) and adds:
 *
 *   - Boolean flags for auth states (isLoading, isAuthenticated, …)
 *   - Role-level computed properties (isAdmin, isManager, isEditor)
 *   - Permission guards (canAccessAdmin, canManageOrganization)
 *   - Strong typing via ExtendedSession → AuthUser mapping
 *
 * @returns UseAuthReturn — enriched session state and helpers
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, isLoading, isAdmin } = useAuth();
 * if (isLoading) return <Spinner />;
 * if (!isAuthenticated) return <SignIn />;
 * if (isAdmin) return <AdminDashboard />;
 * return <UserDashboard />;
 *
 */
export function useAuth(): UseAuthReturn {
  // ------------------------------------------------------------------
  // 1. Consume the next-auth session context
  // ------------------------------------------------------------------
  const { data: session, status, update } = useSession();

  // ------------------------------------------------------------------
  // 2. Derive boolean flags for ergonomic conditional rendering
  // ------------------------------------------------------------------
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const isUnauthenticated = status === "unauthenticated";

  // ------------------------------------------------------------------
  // 3. Extract the typed user object (null-safe)
  // ------------------------------------------------------------------
  const user: AuthUser | null =
    isAuthenticated && (session as ExtendedSession)?.user
      ? {
          id: (session as ExtendedSession).user.id,
          email: (session as ExtendedSession).user.email,
          displayName: (session as ExtendedSession).user.displayName,
          avatarUrl: (session as ExtendedSession).user.avatarUrl,
          organizationId: (session as ExtendedSession).user.organizationId,
          organizationSlug: (session as ExtendedSession).user.organizationSlug,
          organizationName: (session as ExtendedSession).user.organizationName,
          roleId: (session as ExtendedSession).user.roleId,
          roleSlug: (session as ExtendedSession).user.roleSlug,
          roleLevel: (session as ExtendedSession).user.roleLevel,
          status: (session as ExtendedSession).user.status,
          locale: (session as ExtendedSession).user.locale,
          theme: (session as ExtendedSession).user.theme,
        }
      : null;

  // ------------------------------------------------------------------
  // 4. Role-based computed flags
  // ------------------------------------------------------------------
  const roleLevel = user?.roleLevel ?? 0;

  const isAdmin = roleLevel >= ROLE_LEVEL.ADMIN;
  const isManager = roleLevel >= ROLE_LEVEL.MANAGER;
  const isEditor = roleLevel >= ROLE_LEVEL.EDITOR;

  // ------------------------------------------------------------------
  // 5. Organization membership
  // ------------------------------------------------------------------
  const hasOrganization = !!user?.organizationId;

  // ------------------------------------------------------------------
  // 6. Permission guards
  // ------------------------------------------------------------------
  const canAccessAdmin = isAdmin;
  const canManageOrganization = isAdmin || isManager;

  // ------------------------------------------------------------------
  // 7. Return the enriched object
  // ------------------------------------------------------------------
  return {
    session: isAuthenticated ? (session as ExtendedSession) : null,
    user,
    status,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
    update,
    isAdmin,
    isManager,
    isEditor,
    hasOrganization,
    canAccessAdmin,
    canManageOrganization,
  };
}

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------

export type { ExtendedSession };

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

export default useAuth;