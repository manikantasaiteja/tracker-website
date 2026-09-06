"use client";

/**
 * /settings/gmail-sync
 *
 * Gmail Sync Settings page.
 * Allows users to:
 *  - Connect their Gmail account via OAuth
 *  - See their connected email address
 *  - See last sync time and import stats
 *  - Manually trigger a sync
 *  - Disconnect Gmail
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type GmailStatus =
  | { connected: false }
  | {
      connected: true;
      gmailEmail: string;
      lastSyncAt: string | null;
      emailsImported: number;
      connectedAt: string;
    };

type SyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  message: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GmailSyncPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    typeof window !== "undefined" ? createBrowserSupabaseClient() : null
  );

  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-sync interval ref
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Get Supabase session token ──────────────────────────────────────────
  const getAuthHeader = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session ? `Bearer ${session.access_token}` : null;
  }, [supabase]);

  // ── Fetch connection status from API ────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    const authHeader = await getAuthHeader();
    if (!authHeader) {
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch("/api/gmail/status", {
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      setStatus(data);
    } catch {
      setError("Failed to load Gmail status.");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, router]);

  // ── On mount: check for OAuth redirect params + fetch status ────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const oauthError = params.get("error");

    if (connected === "true") {
      setSyncResult(null);
      // Clear URL params without re-render
      window.history.replaceState({}, "", "/settings/gmail-sync");
    }
    if (oauthError) {
      const messages: Record<string, string> = {
        access_denied: "You denied Gmail access. Connect again to enable sync.",
        missing_params: "OAuth callback was missing required parameters.",
        invalid_state: "OAuth state was invalid. Please try connecting again.",
        no_access_token: "Google did not return an access token. Please retry.",
        db_error: "Failed to save Gmail credentials. Please try again.",
        server_error: "Server error during Gmail connection. Please try again.",
      };
      setError(messages[oauthError] ?? `OAuth error: ${oauthError}`);
      window.history.replaceState({}, "", "/settings/gmail-sync");
    }

    fetchStatus();
  }, [fetchStatus]);

  // ── Auto-sync every 10 minutes when connected ───────────────────────────
  useEffect(() => {
    if (status?.connected) {
      syncIntervalRef.current = setInterval(
        () => runSync(/* silent */ true),
        10 * 60 * 1000
      );
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  // ── Connect Gmail ────────────────────────────────────────────────────────
  async function handleConnect() {
    setConnecting(true);
    setError(null);

    const authHeader = await getAuthHeader();
    if (!authHeader) {
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch("/api/gmail/auth", {
        headers: { Authorization: authHeader },
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Failed to get auth URL");
      }

      // Redirect to Google OAuth consent screen
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Gmail.");
      setConnecting(false);
    }
  }

  // ── Run sync (manual or silent auto-sync) ───────────────────────────────
  async function runSync(silent = false) {
    if (syncing) return;
    setSyncing(true);
    if (!silent) {
      setError(null);
      setSyncResult(null);
    }

    const authHeader = await getAuthHeader();
    if (!authHeader) return;

    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Sync failed");
      }

      setSyncResult(data);
      // Refresh status to update lastSyncAt + emailsImported
      await fetchStatus();
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Sync failed.");
      }
    } finally {
      setSyncing(false);
    }
  }

  // ── Disconnect Gmail ─────────────────────────────────────────────────────
  async function handleDisconnect() {
    if (
      !window.confirm(
        "Disconnect Gmail? Your existing imported applications will remain, but auto-sync will stop."
      )
    )
      return;

    setDisconnecting(true);
    setError(null);

    const authHeader = await getAuthHeader();
    if (!authHeader) return;

    try {
      const res = await fetch("/api/gmail/disconnect", {
        method: "POST",
        headers: { Authorization: authHeader },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to disconnect");
      }

      setSyncResult(null);
      await fetchStatus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to disconnect Gmail."
      );
    } finally {
      setDisconnecting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="gmail-sync-shell">
        <div className="gmail-sync-loading">
          <div className="gmail-sync-spinner" />
          <p>Loading Gmail sync settings…</p>
        </div>
      </div>
    );
  }

  const isConnected = status?.connected === true;

  return (
    <div className="gmail-sync-shell">
      {/* ── Header ── */}
      <header className="dashboard-header">
        <Link className="brand-mark brand-mark--small" href="/dashboard">
          <span className="brand-mark__icon">T</span>
          <div>
            <p className="brand-mark__eyebrow">Trackr</p>
            <strong>Settings</strong>
          </div>
        </Link>

        <nav className="dashboard-tabs">
          <Link href="/dashboard" className="tab-link">
            📊 Applications
          </Link>
          <Link href="/tools" className="tab-link">
            🛠️ Tools
          </Link>
          <Link href="/settings/gmail-sync" className="tab-link tab-link--active">
            📧 Gmail Sync
          </Link>
        </nav>

        <div className="dashboard-header__actions">
          <Link href="/dashboard" className="secondary-button">
            ← Back
          </Link>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="gmail-sync-main">
        <section className="hero-panel">
          <div>
            <p className="hero-panel__eyebrow">Settings · Gmail Sync</p>
            <h1>Gmail Auto-Sync</h1>
            <p className="hero-panel__copy">
              Connect your Gmail account to automatically import job-related
              emails. Only emails labelled <strong>Jobs</strong> in Gmail are
              processed — nothing else is read.
            </p>
          </div>
        </section>

        {/* ── Error banner ── */}
        {error && (
          <div className="auth-banner auth-banner--error gmail-sync-banner">
            {error}
            <button
              className="gmail-sync-banner-close"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Success banner ── */}
        {syncResult && (
          <div className="auth-banner auth-banner--success gmail-sync-banner">
            ✅ {syncResult.message}
            <button
              className="gmail-sync-banner-close"
              onClick={() => setSyncResult(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <div className="gmail-sync-cards">
          {/* ── Connection Card ── */}
          <div className="gmail-sync-card">
            <div className="gmail-sync-card__header">
              <span className="gmail-sync-card__icon">📬</span>
              <div>
                <h2>Gmail Connection</h2>
                <p>
                  {isConnected
                    ? "Your Gmail account is connected and syncing."
                    : "Connect your Gmail to start importing job emails."}
                </p>
              </div>
              <span
                className={`gmail-sync-badge ${
                  isConnected
                    ? "gmail-sync-badge--connected"
                    : "gmail-sync-badge--disconnected"
                }`}
              >
                {isConnected ? "● Connected" : "○ Not connected"}
              </span>
            </div>

            {isConnected && status.connected && (
              <div className="gmail-sync-details">
                <div className="gmail-sync-detail-row">
                  <span className="gmail-sync-detail-label">Connected account</span>
                  <span className="gmail-sync-detail-value">
                    {status.gmailEmail}
                  </span>
                </div>
                <div className="gmail-sync-detail-row">
                  <span className="gmail-sync-detail-label">Last synced</span>
                  <span className="gmail-sync-detail-value">
                    {formatDate(status.lastSyncAt)}
                  </span>
                </div>
                <div className="gmail-sync-detail-row">
                  <span className="gmail-sync-detail-label">Emails imported</span>
                  <span className="gmail-sync-detail-value gmail-sync-detail-value--accent">
                    {status.emailsImported}
                  </span>
                </div>
                <div className="gmail-sync-detail-row">
                  <span className="gmail-sync-detail-label">Connected since</span>
                  <span className="gmail-sync-detail-value">
                    {formatDate(status.connectedAt)}
                  </span>
                </div>
              </div>
            )}

            <div className="gmail-sync-card__actions">
              {!isConnected ? (
                <button
                  className="primary-button gmail-sync-connect-btn"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <span className="gmail-sync-spinner gmail-sync-spinner--small" />
                      Redirecting to Google…
                    </>
                  ) : (
                    <>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Connect Gmail
                    </>
                  )}
                </button>
              ) : (
                <button
                  className="secondary-button gmail-sync-disconnect-btn"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect Gmail"}
                </button>
              )}
            </div>
          </div>

          {/* ── Sync Card (only when connected) ── */}
          {isConnected && (
            <div className="gmail-sync-card">
              <div className="gmail-sync-card__header">
                <span className="gmail-sync-card__icon">🔄</span>
                <div>
                  <h2>Sync Controls</h2>
                  <p>
                    Emails sync automatically every 10 minutes. You can also
                    trigger a manual sync any time.
                  </p>
                </div>
              </div>

              <div className="gmail-sync-card__actions">
                <button
                  className="primary-button"
                  onClick={() => runSync(false)}
                  disabled={syncing}
                >
                  {syncing ? (
                    <>
                      <span className="gmail-sync-spinner gmail-sync-spinner--small" />
                      Syncing…
                    </>
                  ) : (
                    "🔄 Sync Now"
                  )}
                </button>
              </div>

              {syncResult && (
                <div className="gmail-sync-stats">
                  <div className="gmail-sync-stat">
                    <strong>{syncResult.imported}</strong>
                    <span>New</span>
                  </div>
                  <div className="gmail-sync-stat">
                    <strong>{syncResult.updated}</strong>
                    <span>Updated</span>
                  </div>
                  <div className="gmail-sync-stat">
                    <strong>{syncResult.skipped}</strong>
                    <span>Skipped</span>
                  </div>
                  <div className="gmail-sync-stat">
                    <strong>{syncResult.total}</strong>
                    <span>Total found</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── How it works Card ── */}
          <div className="gmail-sync-card gmail-sync-card--info">
            <div className="gmail-sync-card__header">
              <span className="gmail-sync-card__icon">ℹ️</span>
              <div>
                <h2>How it works</h2>
                <p>What gets imported and how status is detected.</p>
              </div>
            </div>

            <ol className="gmail-sync-steps">
              <li>
                <strong>Label emails in Gmail</strong> — In your Gmail, create
                a label called <code>Jobs</code> and apply it to job-related
                emails. Only those emails are read.
              </li>
              <li>
                <strong>Auto-detect status</strong> — Email subject and body
                are scanned for keywords:
                <ul className="gmail-sync-keywords">
                  <li>
                    <span className="badge badge--interview">Interview</span>{" "}
                    interview, schedule, hiring manager, phone screen…
                  </li>
                  <li>
                    <span className="badge badge--offer">Offer</span> offer,
                    congratulations, pleased to offer…
                  </li>
                  <li>
                    <span className="badge badge--rejected">Rejected</span>{" "}
                    unfortunately, not selected, regret…
                  </li>
                  <li>
                    <span className="badge badge--assessment">Assessment</span>{" "}
                    assessment, coding challenge, task…
                  </li>
                  <li>
                    <span className="badge badge--applied">Applied</span>{" "}
                    everything else defaults to Applied
                  </li>
                </ul>
              </li>
              <li>
                <strong>Upsert applications</strong> — If a matching company +
                role already exists in your tracker, its status is updated.
                Otherwise a new application is created.
              </li>
              <li>
                <strong>No duplicates</strong> — Each Gmail message ID is
                recorded so it is never imported twice.
              </li>
            </ol>

            <div className="gmail-sync-privacy">
              🔒 <strong>Privacy:</strong> Only read-only Gmail access is
              requested. No emails are stored — only extracted fields (company,
              role, status, date) are saved to your tracker.
            </div>
          </div>

          {/* ── Setup guide Card ── */}
          <div className="gmail-sync-card gmail-sync-card--setup">
            <div className="gmail-sync-card__header">
              <span className="gmail-sync-card__icon">⚙️</span>
              <div>
                <h2>First-time setup</h2>
                <p>Steps to enable Gmail sync for this project.</p>
              </div>
            </div>

            <ol className="gmail-sync-steps">
              <li>
                Go to{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gmail-sync-link"
                >
                  Google Cloud Console → Credentials
                </a>
              </li>
              <li>
                Create a new <strong>OAuth 2.0 Client ID</strong> (Web
                application)
              </li>
              <li>
                Add{" "}
                <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/gmail/callback</code>{" "}
                to <em>Authorised redirect URIs</em>
              </li>
              <li>
                Enable the{" "}
                <a
                  href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gmail-sync-link"
                >
                  Gmail API
                </a>{" "}
                in your Google Cloud project
              </li>
              <li>
                Copy the Client ID and Secret into your{" "}
                <code>.env.local</code> as{" "}
                <code>GOOGLE_CLIENT_ID</code> and{" "}
                <code>GOOGLE_CLIENT_SECRET</code>
              </li>
              <li>
                Run the SQL migration in{" "}
                <code>supabase/gmail-sync-tables.sql</code> in your Supabase
                SQL Editor
              </li>
              <li>Restart your dev server and click Connect Gmail above</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
