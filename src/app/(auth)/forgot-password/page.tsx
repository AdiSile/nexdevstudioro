"use client";

/**
 * NexusDevStudio — Public Forgot Password Page
 * Permite utilizatorilor să solicite resetarea parolei prin email.
 * Design glassmorphism mov/auriu, identic cu identitatea brand-ului.
 *
 * Ruta: /forgot-password  (grupul (auth) este transparent în URL)
 * După trimiterea emailului, afișează confirmare și redirectează la login.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Sparkles,
  ArrowLeft,
  Send,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ═══════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════

export default function PublicForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  // Focus email input on mount
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Clear error when user types
  useEffect(() => {
    if (error) setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      // Validare email
      if (!email.trim()) {
        setError("Introdu adresa de email.");
        emailRef.current?.focus();
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError("Adresa de email nu este validă.");
        emailRef.current?.focus();
        return;
      }

      setLoading(true);

      try {
        const response = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Nu dezvăluim dacă emailul există sau nu — mesaj generic
          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const cooldownSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
            setResendCooldown(cooldownSeconds);
            setError(
              `Prea multe solicitări. Încearcă din nou în ${cooldownSeconds} secunde.`,
            );
            setLoading(false);
            return;
          }

          // Pentru orice altă eroare, tratăm ca succes aparent
          // pentru a nu dezvălui dacă emailul există
          setSent(true);
          setLoading(false);
          return;
        }

        // Succes
        setSent(true);
        setLoading(false);
      } catch {
        // Chiar și la eroare de rețea, tratăm grațios
        setSent(true);
        setLoading(false);
      }
    },
    [email],
  );

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || !email.trim()) return;

    setError("");
    setLoading(true);

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      setResendCooldown(60);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [email, resendCooldown]);

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

      {/* ── Card recuperare parolă ───────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo + badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm font-medium mb-4">
            <KeyRound className="h-3.5 w-3.5" />
            Recuperare Parolă
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Nexus<span className="text-brand-600 dark:text-brand-400">DevStudio</span>
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            {sent
              ? "Verifică-ți emailul pentru instrucțiuni"
              : "Introdu emailul pentru a reseta parola"}
          </p>
        </div>

        {/* Card glassmorphism */}
        <div
          className={cn(
            "rounded-2xl p-8 transition-all duration-300",
            "bg-white/70 dark:bg-neutral-800/70 backdrop-blur-xl",
            "border border-white/20 dark:border-neutral-700/30",
            "shadow-elevation-4",
            sent && "ring-2 ring-accent-500/50",
          )}
        >
          {sent ? (
            /* ── Stare: email trimis ────────────────────────── */
            <div className="text-center py-4 animate-scale-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-50 dark:bg-accent-900/20 mb-4">
                <Sparkles className="h-8 w-8 text-accent-500" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">
                Email trimis!
              </h2>
              <p className="text-text-secondary text-sm mb-2">
                Dacă adresa <span className="font-medium text-text-primary">{email.trim()}</span> este
                asociată unui cont, vei primi în scurt timp un email cu
                instrucțiunile de resetare a parolei.
              </p>
              <p className="text-text-tertiary text-xs mb-6">
                Nu ai primit emailul? Verifică folderul de spam sau{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className={cn(
                    "font-medium underline underline-offset-2 transition-colors",
                    "text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline",
                  )}
                >
                  {resendCooldown > 0
                    ? `Retrimite în ${resendCooldown}s`
                    : "retrimite emailul"}
                </button>
              </p>

              {/* Separator vizual */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-border-default" />
                <span className="text-xs text-text-tertiary">sau</span>
                <div className="flex-1 h-px bg-border-default" />
              </div>

              {/* Înapoi la login */}
              <a
                href="/login"
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all",
                  "bg-brand-500 text-white hover:bg-brand-600 shadow-glow-primary",
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                Înapoi la autentificare
              </a>

              {/* Suport */}
              <p className="text-text-tertiary text-xs mt-6">
                Ai nevoie de ajutor?{" "}
                <a
                  href="/contact"
                  className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors"
                >
                  Contactează suportul
                </a>
              </p>
            </div>
          ) : (
            /* ── Formular email ─────────────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Mesaj eroare */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm animate-slide-in-from-top">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Text informativ */}
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Introdu adresa de email asociată contului tău. Îți vom trimite
                  un link pentru resetarea parolei.
                </span>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Adresa de email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                  <input
                    ref={emailRef}
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
                    )}
                    placeholder="nume@companie.ro"
                  />
                </div>
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
                    Se trimite...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Trimite linkul de resetare
                  </>
                )}
              </button>

              {/* Înapoi la login */}
              <p className="text-center text-sm text-text-secondary">
                <a
                  href="/login"
                  className="inline-flex items-center gap-1.5 font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Înapoi la autentificare
                </a>
              </p>
            </form>
          )}
        </div>

        {/* Înapoi la site */}
        {!sent && (
          <div className="text-center mt-6">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" />
              Înapoi la site
            </a>
          </div>
        )}
      </div>
    </div>
  );
}