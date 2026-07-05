/**
 * NexusDevStudio — API Contact
 *
 * POST /api/contact
 *
 * Salvează un mesaj de contact de la un vizitator.
 *
 * Rate limiting: 5 încercări per IP pe fereastră de 15 minute.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { createComponentLogger } from "@/lib/logger";
import { rateLimitByIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const log = createComponentLogger("contact-api");

// ---------------------------------------------------------------------------
// Constante
// ---------------------------------------------------------------------------

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 150;
const MAX_EMAIL_LENGTH = 320;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_SUBJECT_LENGTH = 200;
const MAX_PHONE_LENGTH = 20;

// Regex
const NAME_REGEX = /^[\p{L}\p{M}\s'-]+$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;

// Listă domenii email temporare (throwaway) – extinde după nevoie
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "yopmail.com",
  "throwaway.email",
  "sharklasers.com",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "127.0.0.1";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")      // elimină taguri HTML
    .replace(/[`$]/g, "")         // elimină backtick și semnul dolar (template injection)
    .trim();
}

/**
 * Validare completă a input-ului (defense in depth).
 */
function validateInput(body: {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  phone?: string;
}): { valid: boolean; error?: string; field?: string } {
  // Nume
  if (!body.name || !body.name.trim()) {
    return { valid: false, error: "Numele este obligatoriu.", field: "name" };
  }
  if (body.name.trim().length < MIN_NAME_LENGTH) {
    return { valid: false, error: `Numele trebuie să aibă minim ${MIN_NAME_LENGTH} caractere.`, field: "name" };
  }
  if (body.name.trim().length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Numele nu poate depăși ${MAX_NAME_LENGTH} caractere.`, field: "name" };
  }
  if (!NAME_REGEX.test(body.name.trim())) {
    return { valid: false, error: "Numele conține caractere nepermise.", field: "name" };
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
  const emailDomain = body.email.trim().split("@")[1]?.toLowerCase();
  if (emailDomain && DISPOSABLE_EMAIL_DOMAINS.has(emailDomain)) {
    return { valid: false, error: "Domeniul de email nu este acceptat. Te rugăm să folosești o adresă reală.", field: "email" };
  }

  // Subiect (opțional)
  if (body.subject && body.subject.trim().length > MAX_SUBJECT_LENGTH) {
    return { valid: false, error: `Subiectul nu poate depăși ${MAX_SUBJECT_LENGTH} caractere.`, field: "subject" };
  }

  // Mesaj
  if (!body.message || !body.message.trim()) {
    return { valid: false, error: "Mesajul este obligatoriu.", field: "message" };
  }
  if (body.message.trim().length < MIN_MESSAGE_LENGTH) {
    return { valid: false, error: `Mesajul trebuie să aibă minim ${MIN_MESSAGE_LENGTH} caractere.`, field: "message" };
  }
  if (body.message.trim().length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Mesajul nu poate depăși ${MAX_MESSAGE_LENGTH} caractere.`, field: "message" };
  }

  // Telefon (opțional)
  if (body.phone && body.phone.trim().length > 0) {
    if (body.phone.trim().length > MAX_PHONE_LENGTH) {
      return { valid: false, error: `Numărul de telefon nu poate depăși ${MAX_PHONE_LENGTH} caractere.`, field: "phone" };
    }
    if (!PHONE_REGEX.test(body.phone.trim())) {
      return { valid: false, error: "Numărul de telefon nu este valid.", field: "phone" };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // ── Rate limiting per IP ─────────────────────────────────────
  const rateLimitResult = await rateLimitByIp(ip, 2); // cheie separată "2" pentru contact
  if (!rateLimitResult.allowed) {
    log.warn("Contact rate limit exceeded", { ip, retryAfter: rateLimitResult.retryAfterSeconds });

    const response = NextResponse.json(
      {
        error: "Ai trimis prea multe mesaje. Încearcă din nou mai târziu.",
        retryAfter: rateLimitResult.retryAfterSeconds,
      },
      { status: 429 },
    );
    response.headers.set("Retry-After", String(rateLimitResult.retryAfterSeconds));
    return response;
  }

  // ── Parse body ───────────────────────────────────────────────
  let body: {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
    phone?: string;
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

  // Sanitizare
  const name = sanitize(body.name!.trim());
  const email = body.email!.trim().toLowerCase();
  const subject = body.subject ? sanitize(body.subject.trim()) : null;
  const message = sanitize(body.message!.trim());
  const phone = body.phone ? sanitize(body.phone.trim()) : null;
  const userAgent = request.headers.get("user-agent") || null;

  const prisma = getPrismaClient();

  // ── Salvează mesajul în baza de date ─────────────────────────
  try {
    await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
        phone,
        ip,
        userAgent,
        status: "NEW",
      },
    });

    log.info("Contact message saved", { email: email.slice(0, 40) });

    return NextResponse.json(
      {
        message: "Mesajul tău a fost trimis cu succes! Te vom contacta în cel mai scurt timp.",
      },
      { status: 201 },
    );
  } catch (err) {
    log.error("Failed to save contact message", {
      email: email.slice(0, 40),
      error: err instanceof Error ? err.message : "unknown",
    });

    return NextResponse.json(
      { error: "A apărut o eroare la trimiterea mesajului. Încearcă din nou." },
      { status: 500 },
    );
  }
}