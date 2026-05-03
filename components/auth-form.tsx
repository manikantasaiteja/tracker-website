"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import PhoneInput, { getCountryCallingCode } from "react-phone-number-input";
import type { Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

type FormState = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
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
    confirmPassword: "",
    phoneNumber: "",
  });
  const [selectedCountry, setSelectedCountry] = useState<Country>("US");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const isLogin = mode === "login";

  async function handleForgotPassword() {
    if (!supabase) {
      setError("Supabase client is still loading. Please try again.");
      return;
    }

    if (!form.email) {
      setError("Please enter your email address first.");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        form.email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        throw resetError;
      }

      setResetEmailSent(true);
      setMessage(
        "Password reset email sent! Check your inbox for instructions."
      );
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to send reset email. Please try again.";
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }

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

      // Verify passwords match
      if (form.password !== form.confirmPassword) {
        throw new Error("Passwords do not match. Please try again.");
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            phone_number: form.phoneNumber,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      // Store additional profile data in user_profiles table
      if (signUpData.user) {
        const { error: profileError } = await supabase
          .from("user_profiles")
          .insert({
            id: signUpData.user.id,
            full_name: form.fullName,
            phone_number: form.phoneNumber,
          });

        if (profileError) {
          console.error("Error creating user profile:", profileError);
        }
      }

      setMessage(
        "Account created. If your project requires email confirmation, verify your inbox before signing in.",
      );
      setForm((current) => ({ ...current, password: "", confirmPassword: "" }));
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
              <>
                <label className="auth-field">
                  <span className="required-field">Full name</span>
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

                <label className="auth-field">
                  <span>Phone number</span>
                  <div className="phone-input-wrapper">
                    <PhoneInput
                      className="auth-input phone-input"
                      defaultCountry="US"
                      country={selectedCountry}
                      onCountryChange={(country) => {
                        if (country) setSelectedCountry(country);
                      }}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          phoneNumber: value || "",
                        }))
                      }
                      placeholder="Enter phone number"
                      value={form.phoneNumber}
                      international={false}
                    />
                    <span className="country-code-display">
                      +{getCountryCallingCode(selectedCountry)}
                    </span>
                  </div>
                </label>
              </>
            ) : null}

            <label className="auth-field">
              <span className="required-field">Email</span>
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
              <span className="required-field">Password</span>
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
              {isLogin ? (
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={handleForgotPassword}
                  disabled={loading || !supabase}
                >
                  Forgot password?
                </button>
              ) : null}
            </label>

            {!isLogin ? (
              <label className="auth-field">
                <span className="required-field">Confirm Password</span>
                <input
                  autoComplete="new-password"
                  className="auth-input"
                  minLength={8}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  placeholder="Re-enter your password"
                  required
                  type="password"
                  value={form.confirmPassword}
                />
              </label>
            ) : null}

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
