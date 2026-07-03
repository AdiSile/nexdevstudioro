"use client";

/**
 * NexusDevStudio — Public Login Page
 * Autentificare utilizatori via next-auth credentials provider.
 * Design glassmorphism mov/auriu, identic cu identitatea brand-ului.
 *
 * Ruta: /login  (grupul (auth) este transparent în URL)
 * După autentificare redirectează la /dashboard sau callbackUrl.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  LogIn,
  Sparkles,
  ArrowRight,
  AlertCircle,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ═══════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════

export default function PublicLoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Focus email input on mount
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Clear error when user types
  useEffect(() => {
    if (error) setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      // Basic validation
      if (!email.trim()) {
        setError("Introdu adresa de email.");
        emailRef.current?.focus();
        return;
      }
      if (!password) {
        setError("Introdu parola.");
        return;
      }

      // Validare format email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError("Adresa de email nu este validă.");
        emailRef.current?.focus();
        return;
      }

      setLoading(true);

      try {
        const result = await signIn("credentials", {
          redirect: false,
          email: email.trim(),
          password,
        });

        if (result?.ok) {
          setSuccess(true);
          setTimeout(() => {
            window.location.href = callbackUrl;
          }, 800);
        } else {
          const errorMessage =
            result?.error === "CredentialsSignin"
              ? "Email sau parolă incorectă. Verifică și încearcă din nou."
              : result?.error || "A apărut o eroare la autentificare. Încearcă din nou.";
          setError(errorMessage);
          setLoading(false);
        }
      } catch {
        setError(
          "A apărut o eroare neașteptată. Verifică conexiunea și încearcă din nou.",
        );
        setLoading(false);
      }
    },
    [email, password, callbackUrl],
  );

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden">
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
        {Array.from({ length: 8 }).map((_, i) => (
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

      {/* ── Card autentificare ───────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo + badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-sm font-medium mb-4">
            <User className="h-3.5 w-3.5" />
            Contul Meu
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Nexus<span className="text-brand-600 dark:text-brand-400">DevStudio</span>
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            Autentifică-te pentru a accesa platforma
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
            /* ── Stare: autentificare reușită ───────────────── */
            <div className="text-center py-6 animate-scale-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-50 dark:bg-accent-900/20 mb-4">
                <Sparkles className="h-8 w-8 text-accent-500" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">
                Autentificare reușită!
              </h2>
              <p className="text-text-secondary text-sm">
                Ești redirecționat către panoul de control...
              </p>
              <div className="mt-4 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div className="h-full rounded-full bg-accent-500 animate-progress-indeterminate w-1/3" />
              </div>
            </div>
          ) : (
            /* ── Formular autentificare ─────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Mesaj eroare */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm animate-slide-in-from-top">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Email
                </label>
                <input
                  ref={emailRef}
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border transition-all text-sm outline-none",
                    "bg-white/80 dark:bg-neutral-700/80 backdrop-blur-sm",
                    "text-text-primary placeholder:text-text-tertiary",
                    "border-border-default focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                  )}
                  placeholder="nume@companie.ro"
                />
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
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 pr-12 rounded-xl border transition-all text-sm outline-none",
                      "bg-white/80 dark:bg-neutral-700/80 backdrop-blur-sm",
                      "text-text-primary placeholder:text-text-tertiary",
                      "border-border-default focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                    )}
                    placeholder="••••••••••••"
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
              </div>

              {/* Link forgot password */}
              <div className="text-right">
                <a
                  href="/forgot-password"
                  className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  Ai uitat parola?
                </a>
              </div>

              {/* Buton submit */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                  "bg-brand-500 text-white hover:bg-brand-600 shadow-glow-primary",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Se autentifică...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Autentificare
                  </>
                )}
              </button>

              {/* Link înregistrare */}
              <p className="text-center text-sm text-text-secondary">
                Nu ai cont?{" "}
                <a
                  href="/auth/register"
                  className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  Înregistrează-te
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