"use client";

/**
 * NexusDevStudio — Public Email Verification Page
 *
 * Verifică adresa de email a utilizatorului printr-un token JWT
 * primit ca parametru în URL (searchParams).
 *
 * Ruta: /verify-email?token=...  (grupul (auth) este transparent în URL)
 *
 * Stări:
 *   - loading  — verificare token în curs
 *   - success  — email verificat, redirect automat la login
 *   - error    — token invalid / expirat / eroare de rețea
 *
 * Design glassmorphism mov/auriu, identic cu identitatea brand-ului.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Loader2,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ═══════════════════════════════════════════════════════════════════════
// Tipuri
// ═══════════════════════════════════════════════════════════════════════

type PageState = "loading" | "success" | "error" | "already-verified";

interface VerificationResult {
  message: string;
  verified?: boolean;
  alreadyVerified?: boolean;
  email?: string;
  displayName?: string;
}

interface ErrorResult {
  error: string;
  code?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Constante
// ═══════════════════════════════════════════════════════════════════════

/** După verificare reușită, redirect la login după acest delay (ms) */
const SUCCESS_REDIRECT_DELAY = 3000;

/** Delay minim pentru animația de loading (experiență vizuală) */
const MIN_LOADING_DELAY = 1200;

// ═══════════════════════════════════════════════════════════════════════
// Sub-componente de stare
// ═══════════════════════════════════════════════════════════════════════

/**
 * Stare: se verifică token-ul.
 */
function LoadingState() {
  return (
    <div className="text-center py-6 animate-scale-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-900/20 mb-4 relative">
        <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-text-primary mb-2">
        Se verifică emailul...
      </h2>
      <p className="text-text-secondary text-sm">
        Te rugăm să aștepți puțin în timp ce verificăm token-ul de confirmare.
      </p>
      <div className="mt-6 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div className="h-full rounded-full bg-brand-500 animate-progress-indeterminate w-1/3" />
      </div>
    </div>
  );
}

/**
 * Stare: email verificat cu succes.
 */
function SuccessState({
  email,
  displayName,
  countdown,
}: {
  email?: string;
  displayName?: string;
  countdown: number;
}) {
  return (
    <div className="text-center py-6 animate-scale-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-50 dark:bg-accent-900/20 mb-4">
        <Sparkles className="h-8 w-8 text-accent-500" />
      </div>
      <h2 className="text-xl font-bold text-text-primary mb-2">
        Email verificat cu succes!
      </h2>
      <p className="text-text-secondary text-sm mb-1">
        {displayName ? (
          <>
            Bun venit,{" "}
            <span className="font-medium text-text-primary">{displayName}</span>
            !
          </>
        ) : (
          "Contul tău a fost activat."
        )}
      </p>
      {email && (
        <p className="text-text-tertiary text-xs mb-4">
          <Mail className="inline h-3.5 w-3.5 mr-1" />
          {email}
        </p>
      )}
      <p className="text-text-secondary text-sm mb-4">
        Ești redirecționat către pagina de autentificare în{" "}
        <span className="font-semibold text-brand-600 dark:text-brand-400">
          {countdown}
        </span>{" "}
        secunde...
      </p>

      {/* Bară de progres pentru countdown */}
      <div className="mt-6 mb-6 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent-500 transition-all duration-1000 ease-linear"
          style={{
            width: `${((SUCCESS_REDIRECT_DELAY / 1000 - countdown) / (SUCCESS_REDIRECT_DELAY / 1000)) * 100}%`,
          }}
        />
      </div>

      {/* Buton manual de redirect */}
      <a
        href="/login"
        className={cn(
          "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all",
          "bg-brand-500 text-white hover:bg-brand-600 shadow-glow-primary",
        )}
      >
        <ArrowRight className="h-4 w-4" />
        Mergi la autentificare
      </a>
    </div>
  );
}

/**
 * Stare: email deja verificat anterior.
 */
function AlreadyVerifiedState({ email }: { email?: string }) {
  return (
    <div className="text-center py-6 animate-scale-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-50 dark:bg-accent-900/20 mb-4">
        <CheckCircle2 className="h-8 w-8 text-accent-500" />
      </div>
      <h2 className="text-xl font-bold text-text-primary mb-2">
        Email deja verificat
      </h2>
      <p className="text-text-secondary text-sm mb-1">
        Această adresă de email a fost deja confirmată.
      </p>
      {email && (
        <p className="text-text-tertiary text-xs mb-4">
          <Mail className="inline h-3.5 w-3.5 mr-1" />
          {email}
        </p>
      )}
      <p className="text-text-secondary text-sm mb-6">
        Te poți autentifica direct în platformă.
      </p>
      <a
        href="/login"
        className={cn(
          "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all",
          "bg-brand-500 text-white hover:bg-brand-600 shadow-glow-primary",
        )}
      >
        <ArrowRight className="h-4 w-4" />
        Mergi la autentificare
      </a>
    </div>
  );
}

/**
 * Stare: eroare la verificare (token invalid, expirat, eroare rețea etc.).
 */
function ErrorState({
  errorMessage,
  isExpired,
  onRetry,
  retrying,
}: {
  errorMessage: string;
  isExpired: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="text-center py-6 animate-scale-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger-50 dark:bg-danger-900/20 mb-4">
        {isExpired ? (
          <AlertCircle className="h-8 w-8 text-warning-500" />
        ) : (
          <XCircle className="h-8 w-8 text-danger-500" />
        )}
      </div>
      <h2 className="text-xl font-bold text-text-primary mb-2">
        {isExpired ? "Link expirat" : "Verificare eșuată"}
      </h2>
      <p className="text-text-secondary text-sm mb-4">{errorMessage}</p>

      {/* Acțiuni */}
      <div className="space-y-3">
        {isExpired && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className={cn(
              "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all w-full sm:w-auto justify-center",
              "bg-amber-500 text-white hover:bg-amber-600",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            {retrying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se trimite...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Retrimite linkul de verificare
              </>
            )}
          </button>
        )}

        <div>
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
        </div>
      </div>

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
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [resultMessage, setResultMessage] = useState("");
  const [resultEmail, setResultEmail] = useState<string | undefined>();
  const [resultDisplayName, setResultDisplayName] = useState<
    string | undefined
  >();
  const [isExpired, setIsExpired] = useState(false);
  const [countdown, setCountdown] = useState(
    Math.ceil(SUCCESS_REDIRECT_DELAY / 1000),
  );
  const [retrying, setRetrying] = useState(false);

  const hasVerified = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // Verificare token la montare
  // ═══════════════════════════════════════════════════════════════

  const verifyToken = useCallback(
    async (verificationToken: string) => {
      if (hasVerified.current) return;
      hasVerified.current = true;

      // Delay minim pentru UX
      const startTime = Date.now();

      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: verificationToken }),
        });

        const data: VerificationResult | ErrorResult = await response.json();

        // Asigură delay minim
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_LOADING_DELAY) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_LOADING_DELAY - elapsed),
          );
        }

        if (!response.ok) {
          const errorData = data as ErrorResult;
          setResultMessage(
            errorData.error ||
              "A apărut o eroare la verificarea emailului. Încearcă din nou.",
          );
          setIsExpired(
            errorData.code === "INVALID_TOKEN" ||
              errorData.error?.toLowerCase().includes("expirat"),
          );
          setPageState("error");
          return;
        }

        const successData = data as VerificationResult;

        if (successData.alreadyVerified) {
          setResultMessage(
            successData.message || "Adresa de email este deja verificată.",
          );
          setResultEmail(successData.email);
          setPageState("already-verified");
          return;
        }

        setResultMessage(
          successData.message ||
            "Adresa de email a fost verificată cu succes!",
        );
        setResultEmail(successData.email);
        setResultDisplayName(successData.displayName);
        setPageState("success");
      } catch {
        setResultMessage(
          "A apărut o eroare de conexiune. Verifică internetul și încearcă din nou.",
        );
        setIsExpired(false);
        setPageState("error");
      }
    },
    [],
  );

  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      setResultMessage(
        "Token-ul de verificare lipsește din URL. Verifică linkul primit prin email și încearcă din nou.",
      );
      setIsExpired(false);
      setPageState("error");
    }
  }, [token, verifyToken]);

  // ═══════════════════════════════════════════════════════════════
  // Countdown + redirect automat la succes
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (pageState !== "success") return;

    const totalSeconds = Math.ceil(SUCCESS_REDIRECT_DELAY / 1000);
    setCountdown(totalSeconds);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current)
            clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    redirectTimerRef.current = setTimeout(() => {
      window.location.href = "/login";
    }, SUCCESS_REDIRECT_DELAY);

    return () => {
      if (countdownTimerRef.current)
        clearInterval(countdownTimerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [pageState]);

  // ═══════════════════════════════════════════════════════════════
  // Retrimitere link verificare
  // ═══════════════════════════════════════════════════════════════

  const handleResendVerification = useCallback(async () => {
    setRetrying(true);
    try {
      window.location.href = "/forgot-password";
    } catch {
      setRetrying(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // Determină iconița și textul badge-ului
  // ═══════════════════════════════════════════════════════════════

  const badgeConfig: Record<
    PageState,
    { icon: React.ReactNode; text: string; className: string }
  > = {
    loading: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: "Verificare Email",
      className:
        "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400",
    },
    success: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      text: "Email Verificat",
      className:
        "bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400",
    },
    "already-verified": {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      text: "Deja Verificat",
      className:
        "bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400",
    },
    error: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      text: "Eroare Verificare",
      className:
        "bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400",
    },
  };

  const badge = badgeConfig[pageState];

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden">
      {/* ── Fundal decorativ: gradient + glow-uri mov/aurii ──────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-500/8 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-amber-400/6 blur-[100px]" />
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

      {/* ── Card verificare email ───────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo + badge */}
        <div className="text-center mb-8">
          <div
            className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-4 transition-colors duration-300",
              badge.className,
            )}
          >
            {badge.icon}
            {badge.text}
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Nexus<span className="text-brand-600 dark:text-brand-400">DevStudio</span>
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            {pageState === "loading" && "Confirmare adresă de email..."}
            {pageState === "success" && "Contul tău este acum activ!"}
            {pageState === "already-verified" &&
              "Emailul tău este deja confirmat."}
            {pageState === "error" &&
              (isExpired
                ? "Linkul de verificare a expirat."
                : "Nu am putut verifica emailul.")}
          </p>
        </div>

        {/* Card glassmorphism */}
        <div
          className={cn(
            "rounded-2xl p-8 transition-all duration-300",
            "bg-white/70 dark:bg-neutral-800/70 backdrop-blur-xl",
            "border border-white/20 dark:border-neutral-700/30",
            "shadow-elevation-4",
            pageState === "success" && "ring-2 ring-accent-500/50",
            pageState === "already-verified" && "ring-2 ring-accent-500/50",
            pageState === "error" && "ring-2 ring-danger-500/30",
          )}
        >
          {pageState === "loading" && <LoadingState />}

          {pageState === "success" && (
            <SuccessState
              email={resultEmail}
              displayName={resultDisplayName}
              countdown={countdown}
            />
          )}

          {pageState === "already-verified" && (
            <AlreadyVerifiedState email={resultEmail} />
          )}

          {pageState === "error" && (
            <ErrorState
              errorMessage={resultMessage}
              isExpired={isExpired}
              onRetry={handleResendVerification}
              retrying={retrying}
            />
          )}
        </div>

        {/* Înapoi la site */}
        {pageState !== "success" && (
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