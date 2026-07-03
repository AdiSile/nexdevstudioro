/**
 * NexusDevStudio — Email Verification API Route
 *
 * POST /api/auth/verify-email
 *
 * Verifică un token JWT de confirmare a adresei de email.
 * Token-ul conține email-ul utilizatorului și o dată de expirare.
 * După verificare, actualizează:
 *   - emailVerified → true
 *   - emailVerifiedAt → acum
 *   - status → ACTIVE
 *
 * Rate limiting: 10 încercări per IP pe fereastră de 15 minute.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { getPrismaClient } from "@/lib/prisma";
import { createComponentLogger } from "@/lib/logger";
import { rateLimitByIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const log = createComponentLogger("verify-email-api");

// ---------------------------------------------------------------------------
// Constante
// ---------------------------------------------------------------------------

/** Durata de valabilitate a token-ului de verificare (24 ore) */
const TOKEN_EXPIRY_HOURS = 24;

/** Secret pentru semnarea token-urilor de verificare */
function getVerificationSecret(): Uint8Array {
  const secret =
    process.env.NEXTAUTH_SECRET ||
    process.env.VERIFICATION_TOKEN_SECRET ||
    "nexusdevstudio-fallback-verification-secret-change-me";
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extrage IP-ul client din headere, cu suport pentru proxy.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "127.0.0.1";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/**
 * Generează un token de verificare email.
 * Poate fi apelat din ruta de register sau din workflow-uri externe.
 */
export async function generateVerificationToken(
  email: string,
): Promise<string> {
  const secret = getVerificationSecret();

  const token = await new SignJWT({ email, purpose: "email-verification" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRY_HOURS}h`)
    .setJti(crypto.randomUUID())
    .sign(secret);

  return token;
}

/**
 * Validează un token de verificare email.
 * Returnează email-ul extras din payload sau null dacă token-ul este invalid.
 */
async function validateVerificationToken(
  token: string,
): Promise<string | null> {
  try {
    const secret = getVerificationSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      !payload.email ||
      typeof payload.email !== "string" ||
      payload.purpose !== "email-verification"
    ) {
      log.warn("Token payload missing required fields", {
        hasEmail: !!payload.email,
        purpose: payload.purpose,
      });
      return null;
    }

    return payload.email.toLowerCase();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    log.warn("Token validation failed", { error: message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // ── Rate limiting per IP ─────────────────────────────────────
  const rateLimitResult = await rateLimitByIp(ip, 2);
  if (!rateLimitResult.allowed) {
    log.warn("Verify-email rate limit exceeded", {
      ip,
      retryAfter: rateLimitResult.retryAfterSeconds,
    });

    const response = NextResponse.json(
      {
        error:
          "Prea multe încercări. Așteaptă înainte de a încerca din nou.",
        retryAfter: rateLimitResult.retryAfterSeconds,
      },
      { status: 429 },
    );

    response.headers.set(
      "Retry-After",
      String(rateLimitResult.retryAfterSeconds),
    );

    return response;
  }

  // ── Parse body ───────────────────────────────────────────────
  let body: { token?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpul cererii este invalid." },
      { status: 400 },
    );
  }

  // ── Validare token prezent ──────────────────────────────────
  if (!body.token || typeof body.token !== "string" || !body.token.trim()) {
    return NextResponse.json(
      { error: "Token-ul de verificare lipsește." },
      { status: 400 },
    );
  }

  const token = body.token.trim();

  // ── Validare token JWT ──────────────────────────────────────
  const email = await validateVerificationToken(token);

  if (!email) {
    return NextResponse.json(
      {
        error:
          "Token-ul de verificare este invalid sau a expirat. Solicită un nou link de verificare.",
        code: "INVALID_TOKEN",
      },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();

  // ── Caută utilizatorul ──────────────────────────────────────
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        status: true,
      },
    });

    if (!user) {
      // Nu dezvăluim că utilizatorul nu există (anti-enumeration)
      log.warn("Verification attempted for non-existent email", {
        email: email.slice(0, 40),
      });
      return NextResponse.json(
        {
          error:
            "Token-ul de verificare este invalid sau a expirat. Solicită un nou link de verificare.",
          code: "INVALID_TOKEN",
        },
        { status: 400 },
      );
    }

    // ── Verifică dacă email-ul este deja verificat ────────────
    if (user.emailVerified) {
      log.info("Email already verified", { userId: user.id });
      return NextResponse.json(
        {
          message: "Adresa de email este deja verificată. Te poți autentifica.",
          alreadyVerified: true,
          email: user.email,
        },
        { status: 200 },
      );
    }

    // ── Verifică status-ul utilizatorului ─────────────────────
    if (user.status !== "PENDING_VERIFICATION") {
      log.warn("User status is not PENDING_VERIFICATION", {
        userId: user.id,
        status: user.status,
      });
      return NextResponse.json(
        {
          message:
            "Contul tău nu necesită verificare suplimentară. Te poți autentifica.",
          alreadyVerified: true,
          email: user.email,
        },
        { status: 200 },
      );
    }

    // ── Activează contul ──────────────────────────────────────
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
        // Resetează metadatele de securitate
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    log.info("Email verified successfully", {
      userId: updatedUser.id,
      email: updatedUser.email?.slice(0, 40),
    });

    return NextResponse.json(
      {
        message:
          "Adresa de email a fost verificată cu succes! Acum te poți autentifica.",
        verified: true,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
      },
      { status: 200 },
    );
  } catch (err) {
    log.error("Email verification failed due to database error", {
      email: email.slice(0, 40),
      error: err instanceof Error ? err.message : "unknown",
    });

    return NextResponse.json(
      { error: "A apărut o eroare internă. Încearcă din nou." },
      { status: 500 },
    );
  }
}