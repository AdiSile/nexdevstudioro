// ============================================================
// NexusDevStudio.ro — AuthProvider (SessionProvider Wrapper)
// ============================================================
//
// Client-side wrapper around next-auth's <SessionProvider>.
// Provides the session context to all client components in the
// React component tree. This file is intended to be used in a
// server component (e.g., the root layout) which fetches the
// server-side session and passes it as a prop.
//
// Usage in layout.tsx (server component):
//
//   import { AuthProvider } from "@/providers/AuthProvider";
//   import { getServerSession } from "next-auth";
//   import { authOptions } from "@/lib/auth/nextauth-config";
//
//   export default async function RootLayout({ children }) {
//     const session = await getServerSession(authOptions);
//     return (
//       <AuthProvider session={session}>
//         {children}
//       </AuthProvider>
//     );
//   }
//
// Usage in any client component:
//
//   import { useSession } from "@/providers/AuthProvider";
//
//   function MyComponent() {
//     const { data: session, status } = useSession();
//     // ...
//   }
//
// Dependencies:
//   next-auth ^4.24

"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ExtendedSession } from "@/lib/auth/nextauth-config";

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

/**
 * Re-export `useSession` for convenience so consumers only need to import
 * from `@/providers/AuthProvider`. Also re-export `signIn`, `signOut` for
 * client-side auth actions.
 */
export {
  useSession,
  signIn,
  signOut,
  getSession,
  getCsrfToken,
  getProviders,
} from "next-auth/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthProviderProps {
  /** The server-side session, obtained via getServerSession() */
  session: (Session & ExtendedSession) | null;
  /** Child components wrapped by the session context */
  children: ReactNode;
  /**
   * How often (in seconds) the client should refetch the session.
   * Default: 300 seconds (5 minutes). Set to 0 to disable polling.
   */
  refetchInterval?: number;
  /**
   * Whether to refetch the session when the window regains focus.
   * Default: true.
   */
  refetchOnWindowFocus?: boolean;
}

// ---------------------------------------------------------------------------
// AuthProvider Component
// ---------------------------------------------------------------------------

/**
 * Client-side SessionProvider wrapper.
 *
 * Provides the NextAuth session context to all descendant client components.
 * The `session` prop should be obtained server-side via `getServerSession()`
 * to avoid a client-side fetch on initial render (eliminates a loading flash).
 *
 * Features:
 *   - Passes the server-side session to avoid initial fetch latency
 *   - Handles session refetching on window focus and periodic intervals
 *   - Re-exports all next-auth/react hooks for convenience
 */
export function AuthProvider({
  session,
  children,
  refetchInterval = 5 * 60, // 5 minutes
  refetchOnWindowFocus = true,
}: AuthProviderProps) {
  return (
    <SessionProvider
      session={session}
      refetchInterval={refetchInterval}
      refetchOnWindowFocus={refetchOnWindowFocus}
      // basePath matches the default Next.js API route for auth
      basePath="/api/auth"
    >
      {children}
    </SessionProvider>
  );
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

export default AuthProvider;