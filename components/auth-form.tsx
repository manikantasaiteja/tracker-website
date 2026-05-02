"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

type FormState = {
  fullName: string;
  email: string;
  password: string;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return createBrowserSupabaseClient();
  });
  const [form, setForm] = useState<FormState>({
    fullName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase client is still loading. Please try again.");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });

        if (signInError) {
          throw signInError;
        }

        router.replace("/dashboard");
        router.refresh();
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      setMessage(
        "Account created. If your project requires email confirmation, verify your inbox before signing in.",
      );
      setForm((current) => ({ ...current, password: "" }));
      router.push("/login");
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again.";
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-shell__hero">
        <div className="brand-mark">
          <span className="brand-mark__icon">T</span>
          <div>
            <p className="brand-mark__eyebrow">Trackr</p>
            <h1>Shape your next move.</h1>
          </div>
        </div>
        <p className="auth-shell__copy">
          Bring the old Trackr feel into a cleaner Next.js workspace with live
          Supabase-backed data, a faster dashboard, and room to grow.
        </p>
        <div className="auth-shell__stats">
          <div>
            <strong>6</strong>
            <span>Application states</span>
          </div>
          <div>
            <strong>1</strong>
            <span>Shared data source</span>
          </div>
          <div>
            <strong>∞</strong>
            <span>Future workflows</span>
          </div>
        </div>
      </section>

      <section className="auth-shell__panel">
        <div className="auth-card">
          <p className="auth-card__eyebrow">
            {isLogin ? "Welcome back" : "Create your account"}
          </p>
          <h2>{isLogin ? "Sign in to Trackr" : "Start tracking applications"}</h2>
          <p className="auth-card__subcopy">
            {isLogin
              ? "Use your Supabase auth account to open your dashboard."
              : "Your applications will be stored in Supabase under your account."}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin ? (
              <label className="auth-field">
                <span>Full name</span>
                <input
                  autoComplete="name"
                  className="auth-input"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  placeholder="Alex Morgan"
                  required
                  value={form.fullName}
                />
              </label>
            ) : null}

            <label className="auth-field">
              <span>Email</span>
              <input
                autoComplete="email"
                className="auth-input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="you@example.com"
                required
                type="email"
                value={form.email}
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="auth-input"
                minLength={8}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="At least 8 characters"
                required
                type="password"
                value={form.password}
              />
            </label>

            {error ? <div className="auth-banner auth-banner--error">{error}</div> : null}
            {message ? (
              <div className="auth-banner auth-banner--success">{message}</div>
            ) : null}

            <button
              className="primary-button auth-submit"
              disabled={loading || !supabase}
              type="submit"
            >
              {loading
                ? "Working..."
                : !supabase
                  ? "Preparing..."
                  : isLogin
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="auth-card__switch">
            {isLogin ? "Need an account?" : "Already have an account?"}{" "}
            <Link href={isLogin ? "/register" : "/login"}>
              {isLogin ? "Register" : "Sign in"}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
