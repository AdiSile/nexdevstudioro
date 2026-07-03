"use client";

/**
 * NexusDevStudio — Public Registration Page
 * Înregistrare utilizator nou cu validare completă și redirect automat.
 * Design glassmorphism mov/auriu, identic cu identitatea brand-ului.
 *
 * Ruta: /register  (grupul (auth) este transparent în URL)
 * După înregistrare reușită, autentifică automat și redirectează la /dashboard.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  UserPlus,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  User,
  Mail,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ═══════════════════════════════════════════════════════════════════════
// Constante
// ═══════════════════════════════════════════════════════════════════════

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 150;

// ═══════════════════════════════════════════════════════════════════════
// Helpers de validare
// ═══════════════════════════════════════════════════════════════════════

interface ValidationErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

function validateForm(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}): ValidationErrors | null {
  const errors: ValidationErrors = {};
  const nameRegex = /^[\p{L}\p{M}\s'-]+$/u;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Prenume
  if (!data.firstName.trim()) {
    errors.firstName = "Prenumele este obligatoriu.";
  } else if (data.firstName.trim().length < 2) {
    errors.firstName = "Prenumele trebuie să aibă minim 2 caractere.";
  } else if (data.firstName.trim().length > MAX_NAME_LENGTH) {
    errors.firstName = `Prenumele nu poate depăși ${MAX_NAME_LENGTH} caractere.`;
  } else if (!nameRegex.test(data.firstName.trim())) {
    errors.firstName = "Prenumele conține caractere nepermise.";
  }

  // Nume
  if (!data.lastName.trim()) {
    errors.lastName = "Numele este obligatoriu.";
  } else if (data.lastName.trim().length < 2) {
    errors.lastName = "Numele trebuie să aibă minim 2 caractere.";
  } else if (data.lastName.trim().length > MAX_NAME_LENGTH) {
    errors.lastName = `Numele nu poate depăși ${MAX_NAME_LENGTH} caractere.`;
  } else if (!nameRegex.test(data.lastName.trim())) {
    errors.lastName = "Numele conține caractere nepermise.";
  }

  // Email
  if (!data.email.trim()) {
    errors.email = "Adresa de email este obligatorie.";
  } else if (!emailRegex.test(data.email.trim())) {
    errors.email = "Adresa de email nu este validă.";
  } else if (data.email.trim().length > 320) {
    errors.email = "Adresa de email este prea lungă.";
  }

  // Parolă
  if (!data.password) {
    errors.password = "Parola este obligatorie.";
  } else if (data.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Parola trebuie să aibă minim ${MIN_PASSWORD_LENGTH} caractere.`;
  } else if (data.password.length > 128) {
    errors.password = "Parola nu poate depăși 128 caractere.";
  } else if (!/[A-Z]/.test(data.password)) {
    errors.password = "Parola trebuie să conțină cel puțin o literă mare.";
  } else if (!/[a-z]/.test(data.password)) {
    errors.password = "Parola trebuie să conțină cel puțin o literă mică.";
  } else if (!/[0-9]/.test(data.password)) {
    errors.password = "Parola trebuie să conțină cel puțin o cifră.";
  } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(data.password)) {
    errors.password =
      "Parola trebuie să conțină cel puțin un caracter special.";
  }

  // Confirmare parolă
  if (!data.confirmPassword) {
    errors.confirmPassword = "Confirmă parola.";
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = "Parolele nu se potrivesc.";
  }

  // Termeni
  if (!data.terms) {
    errors.terms = "Trebuie să accepți termenii și condițiile.";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

// ═══════════════════════════════════════════════════════════════════════
// Componentă indicator putere parolă
// ═══════════════════════════════════════════════════════════════════════

interface PasswordStrengthProps {
  password: string;
}

function getPasswordStrength(
  password: string,
): { score: number; label: string; color: string } {
  if (!password || password.length === 0) {
    return { score: 0, label: "", color: "bg-neutral-300" };
  }

  let score = 0;

  // Lungime
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 12) score++;

  // Complexitate
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Normalizare 0-4
  const normalizedScore = Math.min(4, Math.floor(score / 1.5));

  const levels = [
    { label: "Foarte slabă", color: "bg-danger-500" },
    { label: "Slabă", color: "bg-danger-400" },
    { label: "Medie", color: "bg-warning-400" },
    { label: "Puternică", color: "bg-success-400" },
    { label: "Foarte puternică", color: "bg-success-500" },
  ];

  return {
    score: normalizedScore,
    label: levels[normalizedScore].label,
    color: levels[normalizedScore].color,
  };
}

function PasswordStrengthIndicator({ password }: PasswordStrengthProps) {
  const { score, label, color } = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              i < score ? color : "bg-neutral-200 dark:bg-neutral-700",
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          "text-xs font-medium transition-colors",
          score <= 1 && "text-danger-500",
          score === 2 && "text-warning-500",
          score >= 3 && "text-success-500",
        )}
      >
        {label}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════

export default function PublicRegisterPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [newsletter, setNewsletter] = useState(false);

  const [errors, setErrors] = useState<ValidationErrors | null>(null);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const firstNameRef = useRef<HTMLInputElement>(null);

  // Focus first name input on mount
  useEffect(() => {
    firstNameRef.current?.focus();
  }, []);

  // Clear field errors when user types
  useEffect(() => {
    if (errors?.firstName) {
      setErrors((prev) => (prev ? { ...prev, firstName: undefined } : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName]);

  useEffect(() => {
    if (errors?.lastName) {
      setErrors((prev) => (prev ? { ...prev, lastName: undefined } : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastName]);

  useEffect(() => {
    if (errors?.email) {
      setErrors((prev) => (prev ? { ...prev, email: undefined } : null));
    }
    if (serverError) setServerError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  useEffect(() => {
    if (errors?.password) {
      setErrors((prev) => (prev ? { ...prev, password: undefined } : null));
    }
    if (errors?.confirmPassword) {
      setErrors((prev) =>
        prev ? { ...prev, confirmPassword: undefined } : null,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, confirmPassword]);

  useEffect(() => {
    if (errors?.terms) {
      setErrors((prev) => (prev ? { ...prev, terms: undefined } : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terms]);

  const focusFirstError = useCallback((validationErrors: ValidationErrors) => {
    if (validationErrors.firstName) {
      firstNameRef.current?.focus();
    } else if (validationErrors.lastName) {
      document.getElementById("lastName")?.focus();
    } else if (validationErrors.email) {
      document.getElementById("email")?.focus();
    } else if (validationErrors.password) {
      document.getElementById("password")?.focus();
    } else if (validationErrors.confirmPassword) {
      document.getElementById("confirmPassword")?.focus();
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setServerError("");
      setErrors(null);

      // Validare client-side
      const validationErrors = validateForm({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        terms,
      });

      if (validationErrors) {
        setErrors(validationErrors);
        focusFirstError(validationErrors);
        return;
      }

      setLoading(true);

      try {
        // 1. Înregistrare utilizator
        const registerResponse = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            password,
            newsletter,
          }),
        });

        const registerData = await registerResponse.json();

        if (!registerResponse.ok) {
          const errorMessage =
            registerData.error || "A apărut o eroare la înregistrare.";
          setServerError(errorMessage);

          // Erori specifice pe câmpuri
          if (registerData.field === "email") {
            setErrors({ email: errorMessage });
            document.getElementById("email")?.focus();
          }

          setLoading(false);
          return;
        }

        // 2. Autentificare automată după înregistrare
        const signInResult = await signIn("credentials", {
          redirect: false,
          email: email.trim().toLowerCase(),
          password,
        });

        if (signInResult?.ok) {
          setSuccessMessage(
            registerData.message ||
              "Contul a fost creat cu succes! Ești redirecționat...",
          );
          setSuccess(true);

          // Redirect după animație
          setTimeout(() => {
            window.location.href = callbackUrl;
          }, 1200);
        } else {
          // Înregistrarea a funcționat dar autentificarea nu — caz rar
          setSuccessMessage(
            "Contul a fost creat! Te poți autentifica acum.",
          );
          setSuccess(true);

          setTimeout(() => {
            window.location.href = "/login";
          }, 1500);
        }
      } catch {
        setServerError(
          "A apărut o eroare de conexiune. Verifică internetul și încearcă din nou.",
        );
        setLoading(false);
      }
    },
    [
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      terms,
      newsletter,
      callbackUrl,
      focusFirstError,
    ],
  );

  // Determină dacă avem erori de afișat
  const hasErrors = errors !== null && Object.keys(errors).length > 0;
  const globalError = serverError || (hasErrors && !errors?.email && !errors?.password && !errors?.firstName && !errors?.lastName && !errors?.confirmPassword && !errors?.terms
    ? "Te rugăm să corectezi erorile din formular."
    : "");

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden py-8">
      {/* ── Fundal decorativ: gradient + glow-uri mov/aurii ──────── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Glow stânga-sus (brand / mov) */}
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-500/8 blur-[120px]" />
        {/* Glow dreapta-jos (auriu) */}
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-amber-400/6 blur-[100px]" />
        {/* Glow central (accent / teal) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-accent-400/4 blur-[150px]" />
      </div>

      {/* ── Particule plutitoare decorative ──────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-brand-400/10 dark:bg-brand-400/6 animate-float"
            style={{
              width: `${Math.random() * 8 + 4}px`,
              height: `${Math.random() * 8 + 4}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${Math.random() * 6 + 4}s`,
            }}
          />
        ))}
      </div>

      {/* ── Card înregistrare ────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-lg mx-4">
        {/* Logo + badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400 text-sm font-medium mb-4">
            <UserPlus className="h-3.5 w-3.5" />
            Creează Cont
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Nexus<span className="text-brand-600 dark:text-brand-400">DevStudio</span>
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            Înregistrează-te pentru a accesa platforma
          </p>
        </div>

        {/* Card glassmorphism */}
        <div
          className={cn(
            "rounded-2xl p-8 transition-all duration-300",
            "bg-white/70 dark:bg-neutral-800/70 backdrop-blur-xl",
            "border border-white/20 dark:border-neutral-700/30",
            "shadow-elevation-4",
            success && "ring-2 ring-accent-500/50",
          )}
        >
          {success ? (
            /* ── Stare: înregistrare reușită ────────────────── */
            <div className="text-center py-6 animate-scale-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-50 dark:bg-accent-900/20 mb-4">
                <Sparkles className="h-8 w-8 text-accent-500" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">
                Înregistrare reușită!
              </h2>
              <p className="text-text-secondary text-sm">{successMessage}</p>
              <div className="mt-4 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div className="h-full rounded-full bg-accent-500 animate-progress-indeterminate w-1/3" />
              </div>
            </div>
          ) : (
            /* ── Formular înregistrare ──────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Mesaj eroare global */}
              {globalError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm animate-slide-in-from-top">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {globalError}
                </div>
              )}

              {/* Prenume + Nume (2 coloane) */}
              <div className="grid grid-cols-2 gap-4">
                {/* Prenume */}
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-text-primary mb-1.5"
                  >
                    Prenume
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                    <input
                      ref={firstNameRef}
                      id="firstName"
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={cn(
                        "w-full pl-10 pr-4 py-3 rounded-xl border transition-all text-sm outline-none",
                        "bg-white/80 dark:bg-neutral-700/80 backdrop-blur-sm",
                        "text-text-primary placeholder:text-text-tertiary",
                        "border-border-default focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                        errors?.firstName &&
                          "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20",
                      )}
                      placeholder="Alexandru"
                    />
                  </div>
                  {errors?.firstName && (
                    <p className="mt-1 text-xs text-danger-500">
                      {errors.firstName}
                    </p>
                  )}
                </div>

                {/* Nume */}
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-text-primary mb-1.5"
                  >
                    Nume
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                    <input
                      id="lastName"
                      type="text"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={cn(
                        "w-full pl-10 pr-4 py-3 rounded-xl border transition-all text-sm outline-none",
                        "bg-white/80 dark:bg-neutral-700/80 backdrop-blur-sm",
                        "text-text-primary placeholder:text-text-tertiary",
                        "border-border-default focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                        errors?.lastName &&
                          "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20",
                      )}
                      placeholder="Popescu"
                    />
                  </div>
                  {errors?.lastName && (
                    <p className="mt-1 text-xs text-danger-500">
                      {errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(
                      "w-full pl-10 pr-4 py-3 rounded-xl border transition-all text-sm outline-none",
                      "bg-white/80 dark:bg-neutral-700/80 backdrop-blur-sm",
                      "text-text-primary placeholder:text-text-tertiary",
                      "border-border-default focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                      errors?.email &&
                        "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20",
                    )}
                    placeholder="nume@companie.ro"
                  />
                </div>
                {errors?.email && (
                  <p className="mt-1 text-xs text-danger-500">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Parolă */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Parolă
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      "w-full pl-10 pr-12 py-3 rounded-xl border transition-all text-sm outline-none",
                      "bg-white/80 dark:bg-neutral-700/80 backdrop-blur-sm",
                      "text-text-primary placeholder:text-text-tertiary",
                      "border-border-default focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                      errors?.password &&
                        "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20",
                    )}
                    placeholder={`Minim ${MIN_PASSWORD_LENGTH} caractere`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary transition-colors"
                    tabIndex={-1}
                    aria-label={
                      showPassword ? "Ascunde parola" : "Arată parola"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors?.password && (
                  <p className="mt-1 text-xs text-danger-500">
                    {errors.password}
                  </p>
                )}
                <PasswordStrengthIndicator password={password} />
              </div>

              {/* Confirmă parola */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Confirmă parola
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(
                      "w-full pl-10 pr-12 py-3 rounded-xl border transition-all text-sm outline-none",
                      "bg-white/80 dark:bg-neutral-700/80 backdrop-blur-sm",
                      "text-text-primary placeholder:text-text-tertiary",
                      "border-border-default focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                      errors?.confirmPassword &&
                        "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20",
                    )}
                    placeholder="Reintrodu parola"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary transition-colors"
                    tabIndex={-1}
                    aria-label={
                      showConfirmPassword
                        ? "Ascunde parola"
                        : "Arată parola"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors?.confirmPassword && (
                  <p className="mt-1 text-xs text-danger-500">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Termeni și condiții */}
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                    className={cn(
                      "mt-0.5 h-4 w-4 rounded border-border-default text-brand-500",
                      "focus:ring-2 focus:ring-brand-500/20 focus:ring-offset-0",
                      "cursor-pointer",
                    )}
                  />
                  <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                    Sunt de acord cu{" "}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
                      tabIndex={-1}
                    >
                      Termenii și Condițiile
                    </a>{" "}
                    și{" "}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
                      tabIndex={-1}
                    >
                      Politica de Confidențialitate
                    </a>
                  </span>
                </label>
                {errors?.terms && (
                  <p className="text-xs text-danger-500 ml-6">
                    {errors.terms}
                  </p>
                )}

                {/* Newsletter (opțional) */}
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={newsletter}
                    onChange={(e) => setNewsletter(e.target.checked)}
                    className={cn(
                      "mt-0.5 h-4 w-4 rounded border-border-default text-brand-500",
                      "focus:ring-2 focus:ring-brand-500/20 focus:ring-offset-0",
                      "cursor-pointer",
                    )}
                  />
                  <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                    Doresc să primesc noutăți, oferte și actualizări prin email
                  </span>
                </label>
              </div>

              {/* Buton submit */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-2",
                  "bg-brand-500 text-white hover:bg-brand-600 shadow-glow-primary",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Se înregistrează...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Înregistrează-te
                  </>
                )}
              </button>

              {/* Link autentificare */}
              <p className="text-center text-sm text-text-secondary">
                Ai deja cont?{" "}
                <a
                  href="/login"
                  className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  Autentifică-te
                </a>
              </p>
            </form>
          )}
        </div>

        {/* Înapoi la site */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            Înapoi la site
          </a>
        </div>
      </div>
    </div>
  );
}