/**
 * NexusDevStudio — Registration API Route
 *
 * POST /api/auth/register
 *
 * Creează un utilizator nou cu credențiale email/parolă.
 * Hash-uiește parola cu argon2id și setează status-ul PENDING_VERIFICATION.
 *
 * Rate limiting: 5 încercări per IP pe fereastră de 15 minute.
 */

import { NextRequest, NextResponse } from "next/server";
import * as argon2 from "argon2";
import { getPrismaClient } from "@/lib/prisma";
import { createComponentLogger } from "@/lib/logger";
import { rateLimitByIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const log = createComponentLogger("register-api");

// ---------------------------------------------------------------------------
// Constante
// ---------------------------------------------------------------------------

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 150;
const MAX_EMAIL_LENGTH = 320;

// Regex pentru validare
const NAME_REGEX = /^[\p{L}\p{M}\s'-]+$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * Validare input pe server (defense in depth).
 */
function validateInput(body: {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
}): { valid: boolean; error?: string; field?: string } {
  // Prenume
  if (!body.firstName || !body.firstName.trim()) {
    return { valid: false, error: "Prenumele este obligatoriu.", field: "firstName" };
  }
  if (body.firstName.trim().length < 2) {
    return { valid: false, error: "Prenumele trebuie să aibă minim 2 caractere.", field: "firstName" };
  }
  if (body.firstName.trim().length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Prenumele nu poate depăși ${MAX_NAME_LENGTH} caractere.`, field: "firstName" };
  }
  if (!NAME_REGEX.test(body.firstName.trim())) {
    return { valid: false, error: "Prenumele conține caractere nepermise.", field: "firstName" };
  }

  // Nume
  if (!body.lastName || !body.lastName.trim()) {
    return { valid: false, error: "Numele este obligatoriu.", field: "lastName" };
  }
  if (body.lastName.trim().length < 2) {
    return { valid: false, error: "Numele trebuie să aibă minim 2 caractere.", field: "lastName" };
  }
  if (body.lastName.trim().length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Numele nu poate depăși ${MAX_NAME_LENGTH} caractere.`, field: "lastName" };
  }
  if (!NAME_REGEX.test(body.lastName.trim())) {
    return { valid: false, error: "Numele conține caractere nepermise.", field: "lastName" };
  }

  // Email
  if (!body.email || !body.email.trim()) {
    return { valid: false, error: "Adresa de email este obligatorie.", field: "email" };
  }
  if (body.email.trim().length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: "Adresa de email este prea lungă.", field: "email" };
  }
  if (!EMAIL_REGEX.test(body.email.trim())) {
    return { valid: false, error: "Adresa de email nu este validă.", field: "email" };
  }

  // Parolă
  if (!body.password) {
    return { valid: false, error: "Parola este obligatorie.", field: "password" };
  }
  if (body.password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Parola trebuie să aibă minim ${MIN_PASSWORD_LENGTH} caractere.`, field: "password" };
  }
  if (body.password.length > 128) {
    return { valid: false, error: "Parola nu poate depăși 128 caractere.", field: "password" };
  }
  if (!/[A-Z]/.test(body.password)) {
    return { valid: false, error: "Parola trebuie să conțină cel puțin o literă mare.", field: "password" };
  }
  if (!/[a-z]/.test(body.password)) {
    return { valid: false, error: "Parola trebuie să conțină cel puțin o literă mică.", field: "password" };
  }
  if (!/[0-9]/.test(body.password)) {
    return { valid: false, error: "Parola trebuie să conțină cel puțin o cifră.", field: "password" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(body.password)) {
    return { valid: false, error: "Parola trebuie să conțină cel puțin un caracter special.", field: "password" };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // ── Rate limiting per IP ─────────────────────────────────────
  const rateLimitResult = await rateLimitByIp(ip, 1);
  if (!rateLimitResult.allowed) {
    log.warn("Registration rate limit exceeded", {
      ip,
      retryAfter: rateLimitResult.retryAfterSeconds,
    });

    const response = NextResponse.json(
      {
        error: "Prea multe încercări de înregistrare. Încearcă din nou mai târziu.",
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
  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    newsletter?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpul cererii este invalid." },
      { status: 400 },
    );
  }

  // ── Validare input ───────────────────────────────────────────
  const validation = validateInput(body);

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, field: validation.field },
      { status: 400 },
    );
  }

  const email = body.email!.trim().toLowerCase();
  const firstName = body.firstName!.trim();
  const lastName = body.lastName!.trim();
  const password = body.password!;
  const displayName = `${firstName} ${lastName}`;

  const prisma = getPrismaClient();

  // ── Verifică dacă email-ul există deja ──────────────────────
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    if (existingUser) {
      // Nu dezvălui dacă contul există (prevenire user enumeration)
      // Dar oferă un mesaj util
      if (existingUser.status === "PENDING_VERIFICATION") {
        return NextResponse.json(
          {
            error:
              "Există deja un cont cu acest email care așteaptă verificarea. Verifică inbox-ul pentru email-ul de confirmare.",
            field: "email",
          },
          { status: 409 },
        );
      }

      // Pentru orice alt status, mesaj generic
      return NextResponse.json(
        {
          error:
            "Există deja un cont asociat acestei adrese de email. Încearcă autentificarea sau resetarea parolei.",
          field: "email",
        },
        { status: 409 },
      );
    }
  } catch (err) {
    log.error("Database lookup failed during registration", {
      email: email.slice(0, 40),
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "A apărut o eroare internă. Încearcă din nou." },
      { status: 500 },
    );
  }

  // ── Hash parola cu argon2id ─────────────────────────────────
  let passwordHash: string;
  try {
    passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64 MiB (OWASP 2024)
      timeCost: 3,        // 3 iterații
      parallelism: 2,     // 2 lane-uri
      hashLength: 32,
    });
  } catch (err) {
    log.error("Password hashing failed", {
      email: email.slice(0, 40),
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "A apărut o eroare la procesarea parolei." },
      { status: 500 },
    );
  }

  // ── Creează utilizatorul ────────────────────────────────────
  try {
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        displayName,
        status: "PENDING_VERIFICATION",
        locale: "ro",
        theme: "system",
        metadata: {
          newsletter: body.newsletter ?? false,
          registrationIp: ip,
          registrationUserAgent: request.headers.get("user-agent") || null,
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        createdAt: true,
      },
    });

    log.info("User registered successfully", {
      userId: newUser.id,
      email: newUser.email.slice(0, 40),
    });

    return NextResponse.json(
      {
        message: "Contul a fost creat cu succes! Te poți autentifica acum.",
        user: {
          id: newUser.id,
          email: newUser.email,
          displayName: newUser.displayName,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    log.error("User creation failed", {
      email: email.slice(0, 40),
      error: err instanceof Error ? err.message : "unknown",
    });

    // Verifică eroare de constrângere unică (race condition)
    const errorMessage =
      err instanceof Error &&
      (err.message.includes("Unique constraint") ||
        err.message.includes("unique"))
        ? "Există deja un cont asociat acestei adrese de email."
        : "A apărut o eroare la crearea contului. Încearcă din nou.";

    const statusCode =
      err instanceof Error &&
      (err.message.includes("Unique constraint") ||
        err.message.includes("unique"))
        ? 409
        : 500;

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
