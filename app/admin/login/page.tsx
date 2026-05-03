"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createBrowserSupabaseClient();
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase client is still loading. Please try again.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      // Check if user is an admin
      const { data: adminData, error: adminError } = await supabase
        .from("admins")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (adminError || !adminData) {
        await supabase.auth.signOut();
        throw new Error("Access denied. Admin privileges required.");
      }

      router.replace("/admin/dashboard");
      router.refresh();
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
          <span className="brand-mark__icon">A</span>
          <div>
            <p className="brand-mark__eyebrow">Admin Portal</p>
            <h1>Manage your platform.</h1>
          </div>
        </div>
        <p className="auth-shell__copy">
          Access the admin dashboard to approve user registrations and manage platform access.
        </p>
      </section>

      <section className="auth-shell__panel">
        <div className="auth-card">
          <p className="auth-card__eyebrow">Admin Access</p>
          <h2>Sign in to Admin Portal</h2>
          <p className="auth-card__subcopy">
            Only authorized administrators can access this portal.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="required-field">Email</span>
              <input
                autoComplete="email"
                className="auth-input"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="auth-field">
              <span className="required-field">Password</span>
              <input
                autoComplete="current-password"
                className="auth-input"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                type="password"
                value={password}
              />
            </label>

            {error ? <div className="auth-banner auth-banner--error">{error}</div> : null}

            <button
              className="primary-button auth-submit"
              disabled={loading || !supabase}
              type="submit"
            >
              {loading ? "Signing in..." : !supabase ? "Preparing..." : "Sign in"}
            </button>
          </form>

          <p className="auth-card__switch">
            <Link href="/login">Back to user login</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
