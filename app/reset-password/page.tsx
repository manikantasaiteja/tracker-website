"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createBrowserSupabaseClient();
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    // Check if user has a valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      } else {
        setError("Invalid or expired reset link. Please request a new one.");
      }
    });
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase client is still loading. Please try again.");
      return;
    }

    setError(null);
    setMessage(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please try again.");
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setMessage("Password updated successfully! Redirecting to login...");
      
      // Sign out and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push("/login");
      }, 2000);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update password. Please try again.";
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }

  if (!supabase) {
    return (
      <div className="route-loader">
        <div className="route-loader__pulse" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <section className="auth-shell__hero">
        <div className="brand-mark">
          <span className="brand-mark__icon">T</span>
          <div>
            <p className="brand-mark__eyebrow">Trackr</p>
            <h1>Reset your password.</h1>
          </div>
        </div>
        <p className="auth-shell__copy">
          Enter your new password below. Make sure it's at least 8 characters
          long and something you'll remember.
        </p>
      </section>

      <section className="auth-shell__panel">
        <div className="auth-card">
          <p className="auth-card__eyebrow">Password Reset</p>
          <h2>Create new password</h2>
          <p className="auth-card__subcopy">
            Choose a strong password to secure your account.
          </p>

          {isValidSession ? (
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span className="required-field">New Password</span>
                <input
                  autoComplete="new-password"
                  className="auth-input"
                  minLength={8}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                  type="password"
                  value={newPassword}
                />
              </label>

              <label className="auth-field">
                <span className="required-field">Confirm New Password</span>
                <input
                  autoComplete="new-password"
                  className="auth-input"
                  minLength={8}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>

              {error ? (
                <div className="auth-banner auth-banner--error">{error}</div>
              ) : null}
              {message ? (
                <div className="auth-banner auth-banner--success">{message}</div>
              ) : null}

              <button
                className="primary-button auth-submit"
                disabled={loading}
                type="submit"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          ) : (
            <div className="auth-form">
              {error ? (
                <div className="auth-banner auth-banner--error">{error}</div>
              ) : null}
              <Link href="/login" className="primary-button auth-submit" style={{ textAlign: "center", display: "block" }}>
                Back to Login
              </Link>
            </div>
          )}

          <p className="auth-card__switch">
            Remember your password?{" "}
            <Link href="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
