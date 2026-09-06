"use client";

import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState, useCallback, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

// ── SVG Icons (no emojis — avoids encoding issues) ───────────────────────────
const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);
const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconWarning = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
  </svg>
);
const IconGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="3" y2="15"/>
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IconEdit = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────────
type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  resumeFileName: string | null;
  resumeFileUrl: string | null;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type GmailStatus =
  | { connected: false }
  | { connected: true; gmailEmail: string; lastSyncAt: string | null; emailsImported: number };

type SyncResult = { imported: number; updated: number; skipped: number; message: string };

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") return null;
    return createBrowserSupabaseClient();
  });

  const [profile, setProfile] = useState<UserProfile>({ firstName: "", lastName: "", email: "", phoneNumber: "", resumeFileName: null, resumeFileUrl: null });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState("Guest");

  // Gmail sync state
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailSyncResult, setGmailSyncResult] = useState<SyncResult | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getAuthHeader = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session ? `Bearer ${session.access_token}` : null;
  }, [supabase]);

  const fetchGmailStatus = useCallback(async () => {
    const authHeader = await getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch("/api/gmail/status", { headers: { Authorization: authHeader } });
      const data = await res.json();
      setGmailStatus(data);
    } catch { /* gmail is optional */ } finally {
      setGmailLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    if (!supabase) return;
    async function loadProfile() {
      try {
        const { data: { session }, error: sessionError } = await supabase!.auth.getSession();
        if (sessionError || !session?.user) { router.replace("/login"); return; }
        setUserId(session.user.id);
        const { data: profileData } = await supabase!.from("user_profiles").select("*").eq("id", session.user.id).single();
        const fullName = profileData?.full_name || session.user.user_metadata.full_name || "";
        const nameParts = fullName.split(" ");
        setUserLabel(fullName || session.user.email || "Trackr user");
        setProfile({ firstName: nameParts[0] || "", lastName: nameParts.slice(1).join(" ") || "", email: session.user.email || "", phoneNumber: profileData?.phone_number || "", resumeFileName: profileData?.resume_file_name || null, resumeFileUrl: profileData?.resume_file_url || null });
      } catch (err) { console.error("Error loading profile:", err); }
      finally { setLoading(false); }
    }
    loadProfile();
    fetchGmailStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected") === "true") { window.history.replaceState({}, "", "/profile"); fetchGmailStatus(); }
    const oauthErr = params.get("gmail_error");
    if (oauthErr) {
      const msgs: Record<string, string> = { access_denied: "Gmail access was denied. Please try again.", db_error: "Failed to save Gmail credentials. Please try again.", server_error: "Server error during Gmail connection. Please retry." };
      setGmailError(msgs[oauthErr] ?? `Gmail error: ${oauthErr}`);
      window.history.replaceState({}, "", "/profile");
    }
  }, [supabase, router, fetchGmailStatus]);

  useEffect(() => {
    if (gmailStatus?.connected) {
      syncIntervalRef.current = setInterval(() => runGmailSync(true), 10 * 60 * 1000);
    }
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmailStatus?.connected]);

  async function handleGmailConnect() {
    if (!termsAccepted) { setGmailError("Please accept the terms to continue."); return; }
    setGmailConnecting(true); setGmailError(null);
    const authHeader = await getAuthHeader();
    if (!authHeader) { router.replace("/login"); return; }
    try {
      const res = await fetch("/api/gmail/auth", { headers: { Authorization: authHeader } });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to get auth URL");
      window.location.href = data.url;
    } catch (err) { setGmailError(err instanceof Error ? err.message : "Failed to connect Gmail."); setGmailConnecting(false); }
  }

  async function runGmailSync(silent = false) {
    if (gmailSyncing) return;
    setGmailSyncing(true);
    if (!silent) { setGmailError(null); setGmailSyncResult(null); }
    const authHeader = await getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST", headers: { Authorization: authHeader } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      if (!silent) setGmailSyncResult(data);
      await fetchGmailStatus();
    } catch (err) { if (!silent) setGmailError(err instanceof Error ? err.message : "Sync failed."); }
    finally { setGmailSyncing(false); }
  }

  async function handleGmailDisconnect() {
    if (!window.confirm("Disconnect Gmail? Auto-sync will stop. Your imported applications will remain.")) return;
    setGmailDisconnecting(true); setGmailError(null);
    const authHeader = await getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch("/api/gmail/disconnect", { method: "POST", headers: { Authorization: authHeader } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed to disconnect"); }
      setGmailSyncResult(null); setTermsAccepted(false); await fetchGmailStatus();
    } catch (err) { setGmailError(err instanceof Error ? err.message : "Failed to disconnect Gmail."); }
    finally { setGmailDisconnecting(false); }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) { setError("Unable to save profile. Please try again."); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      const fullName = `${profile.firstName} ${profile.lastName}`.trim();
      const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (metadataError) throw metadataError;
      const { error: profileError } = await supabase.from("user_profiles").upsert({ id: userId, full_name: fullName, phone_number: profile.phoneNumber });
      if (profileError) throw profileError;
      setMessage("Profile updated successfully!");
      setEditingProfile(false);
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Failed to update profile."); }
    finally { setSaving(false); }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setPasswordError("Unable to change password. Please try again."); return; }
    setPasswordError(null); setPasswordMessage(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setPasswordError("New passwords do not match."); return; }
    if (passwordForm.newPassword.length < 8) { setPasswordError("Password must be at least 8 characters long."); return; }
    setChangingPassword(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (updateError) throw updateError;
      setPasswordMessage("Password updated successfully!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (caughtError) { setPasswordError(caughtError instanceof Error ? caughtError.message : "Failed to update password."); }
    finally { setChangingPassword(false); }
  }

  async function handleDeleteAccount() {
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;
    if (!window.confirm("This is your last chance. Are you absolutely sure?")) return;
    if (!supabase || !userId) return;
    try {
      await supabase.from("applications").delete().eq("user_id", userId);
      await supabase.from("user_profiles").delete().eq("id", userId);
      await supabase.auth.signOut();
      router.replace("/");
    } catch { setError("Failed to delete account. Please contact support."); }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleResumeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !supabase) return;
    const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) { setResumeError("Invalid file type. Only PDF, DOC, and DOCX are allowed."); return; }
    if (file.size > 5 * 1024 * 1024) { setResumeError("File size exceeds 5MB limit."); return; }
    setUploadingResume(true); setResumeError(null); setResumeMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/resume/upload", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Upload failed with status ${response.status}`);
      setProfile((c) => ({ ...c, resumeFileName: data.fileName, resumeFileUrl: data.fileUrl }));
      setResumeMessage("Resume uploaded successfully!");
    } catch (err) { setResumeError(err instanceof Error ? err.message : "Failed to upload resume"); }
    finally { setUploadingResume(false); event.target.value = ""; }
  }

  async function handleResumeDownload() {
    if (!supabase || !profile.resumeFileUrl) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      const response = await fetch("/api/resume/download", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) throw new Error("Failed to download resume");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = profile.resumeFileName || "resume.pdf";
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (err) { setResumeError(err instanceof Error ? err.message : "Failed to download resume"); }
  }

  async function handleResumeDelete() {
    if (!supabase || !profile.resumeFileUrl) return;
    if (!window.confirm("Delete your resume? This cannot be undone.")) return;
    setResumeError(null); setResumeMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      const response = await fetch("/api/resume/delete", { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete resume");
      setProfile((c) => ({ ...c, resumeFileName: null, resumeFileUrl: null }));
      setResumeMessage("Resume deleted successfully!");
    } catch (err) { setResumeError(err instanceof Error ? err.message : "Failed to delete resume"); }
  }

  if (loading || !supabase) {
    return (
      <main className="route-loader">
        <div className="route-loader__pulse" />
        <p>Loading profile...</p>
      </main>
    );
  }

  const gmailConnected = gmailStatus?.connected === true;

  return (
    <div className="dashboard-shell">
      <DashboardHeader userLabel={userLabel} onSignOut={handleSignOut} />
      <main className="dashboard-main">
        <div className="profile-layout">

          {/* Profile Header */}
          <section className="profile-header-card">
            <div className="profile-avatar-large">
              {profile.firstName.charAt(0).toUpperCase() || "U"}
              {profile.lastName.charAt(0).toUpperCase() || ""}
            </div>
            <div>
              <h1 className="profile-name">{profile.firstName} {profile.lastName}</h1>
              <p className="profile-email">{profile.email}</p>
              <p className="profile-phone">{profile.phoneNumber || "No phone number"}</p>
            </div>
          </section>

          {/* Personal Information */}
          <section className="profile-section-card">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon"><IconUser /></span>
                <h2 className="section-title-main">Personal information</h2>
              </div>
              {!editingProfile && (
                <button className="edit-button" onClick={() => setEditingProfile(true)} type="button">
                  <IconEdit /> Edit
                </button>
              )}
            </div>
            {editingProfile ? (
              <form className="profile-edit-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <label className="profile-field-inline">
                    <span>FIRST NAME</span>
                    <input className="profile-input-inline" onChange={(e) => setProfile((c) => ({ ...c, firstName: e.target.value }))} required type="text" value={profile.firstName} />
                  </label>
                  <label className="profile-field-inline">
                    <span>SURNAME</span>
                    <input className="profile-input-inline" onChange={(e) => setProfile((c) => ({ ...c, lastName: e.target.value }))} required type="text" value={profile.lastName} />
                  </label>
                </div>
                <label className="profile-field-inline">
                  <span>EMAIL ADDRESS</span>
                  <input className="profile-input-inline" disabled type="email" value={profile.email} />
                </label>
                <label className="profile-field-inline">
                  <span>PHONE NUMBER</span>
                  <PhoneInput className="profile-input-inline phone-input" defaultCountry="US" international onChange={(value) => setProfile((c) => ({ ...c, phoneNumber: value || "" }))} value={profile.phoneNumber} />
                </label>
                {error && <div className="auth-banner auth-banner--error">{error}</div>}
                {message && <div className="auth-banner auth-banner--success">{message}</div>}
                <div className="form-actions">
                  <button className="secondary-button" onClick={() => setEditingProfile(false)} type="button">Cancel</button>
                  <button className="primary-button" disabled={saving} type="submit">{saving ? "Saving..." : "Save changes"}</button>
                </div>
              </form>
            ) : (
              <div className="profile-info-grid">
                <div className="info-item"><span className="info-label">FIRST NAME</span><span className="info-value">{profile.firstName}</span></div>
                <div className="info-item"><span className="info-label">SURNAME</span><span className="info-value">{profile.lastName}</span></div>
                <div className="info-item"><span className="info-label">EMAIL ADDRESS</span><span className="info-value">{profile.email}</span></div>
                <div className="info-item"><span className="info-label">PHONE NUMBER</span><span className="info-value">{profile.phoneNumber || "Not set"}</span></div>
              </div>
            )}
          </section>

          {/* Gmail Auto-Sync */}
          <section className="profile-section-card gmail-profile-section">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon"><IconMail /></span>
                <h2 className="section-title-main">Gmail Auto-Sync</h2>
              </div>
              {gmailConnected && (
                <span className="gmail-profile-badge gmail-profile-badge--on">Active</span>
              )}
            </div>

            <p className="gmail-profile-desc">
              Automatically import job applications from your Gmail. Only emails you label{" "}
              <strong>Jobs</strong> in Gmail are read — nothing else is accessed.
            </p>

            {gmailError && (
              <div className="auth-banner auth-banner--error gmail-profile-banner">
                {gmailError}
                <button className="gmail-sync-banner-close" onClick={() => setGmailError(null)} aria-label="Dismiss">x</button>
              </div>
            )}
            {gmailSyncResult && (
              <div className="auth-banner auth-banner--success gmail-profile-banner">
                {gmailSyncResult.message}
                <button className="gmail-sync-banner-close" onClick={() => setGmailSyncResult(null)} aria-label="Dismiss">x</button>
              </div>
            )}

            {gmailLoading ? (
              <div className="gmail-profile-loading">
                <span className="gmail-sync-spinner gmail-sync-spinner--small" />
                Checking Gmail connection...
              </div>
            ) : gmailConnected && gmailStatus.connected ? (
              <div className="gmail-profile-connected">
                <div className="gmail-profile-info-grid">
                  <div className="gmail-profile-info-item">
                    <span className="gmail-profile-info-label">Connected account</span>
                    <span className="gmail-profile-info-value">{gmailStatus.gmailEmail}</span>
                  </div>
                  <div className="gmail-profile-info-item">
                    <span className="gmail-profile-info-label">Last synced</span>
                    <span className="gmail-profile-info-value">{formatDate(gmailStatus.lastSyncAt)}</span>
                  </div>
                  <div className="gmail-profile-info-item">
                    <span className="gmail-profile-info-label">Emails imported</span>
                    <span className="gmail-profile-info-value gmail-profile-info-value--accent">{gmailStatus.emailsImported}</span>
                  </div>
                </div>
                <div className="gmail-profile-actions">
                  <button className="primary-button" onClick={() => runGmailSync(false)} disabled={gmailSyncing}>
                    <IconRefresh />
                    {gmailSyncing ? "Syncing..." : "Sync Now"}
                  </button>
                  <button className="secondary-button gmail-profile-disconnect-btn" onClick={handleGmailDisconnect} disabled={gmailDisconnecting}>
                    {gmailDisconnecting ? "Disconnecting..." : "Disconnect Gmail"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="gmail-profile-connect">
                <div className="gmail-profile-terms">
                  <label className="gmail-profile-terms-label">
                    <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="gmail-profile-terms-checkbox" />
                    <span>
                      I agree to the{" "}
                      <button type="button" className="gmail-profile-terms-link" onClick={() => setShowTerms((v) => !v)}>
                        Gmail Sync Terms &amp; Conditions
                      </button>
                    </span>
                  </label>
                  {showTerms && (
                    <div className="gmail-profile-terms-body">
                      <h4>Gmail Sync — Terms &amp; Conditions</h4>
                      <p>By connecting your Gmail account, you agree to the following:</p>
                      <ul>
                        <li><strong>Read-only access:</strong> Trackr requests read-only permission to your Gmail. We cannot send, delete, or modify any emails.</li>
                        <li><strong>Jobs label only:</strong> Only emails you have manually labelled <em>Jobs</em> in Gmail are processed. All other emails are completely ignored.</li>
                        <li><strong>Data stored:</strong> We store only extracted fields — company name, job title, application status, and date. Email content is never stored.</li>
                        <li><strong>No third parties:</strong> Your Gmail data is never shared with or sold to any third party.</li>
                        <li><strong>Revocable:</strong> You can disconnect Gmail at any time from this page. Disconnecting immediately revokes access.</li>
                        <li><strong>Security:</strong> OAuth tokens are stored securely and used solely to fetch your job-labelled emails.</li>
                      </ul>
                      <p>For questions, contact us through the Help page.</p>
                    </div>
                  )}
                </div>
                <button className="primary-button gmail-profile-connect-btn" onClick={handleGmailConnect} disabled={gmailConnecting || !termsAccepted}>
                  {gmailConnecting ? (
                    <><span className="gmail-sync-spinner gmail-sync-spinner--small" /> Redirecting to Google...</>
                  ) : (
                    <><IconGoogle /> Connect Gmail</>
                  )}
                </button>
                <p className="gmail-profile-hint">
                  Read-only access &middot; Only <strong>Jobs</strong>-labelled emails &middot; Syncs every 10 min
                </p>
              </div>
            )}
          </section>

          {/* Resume */}
          <section className="profile-section-card">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon"><IconFile /></span>
                <h2 className="section-title-main">Resume</h2>
              </div>
            </div>
            <div className="resume-section">
              {profile.resumeFileName ? (
                <div className="resume-uploaded">
                  <div className="resume-info">
                    <span className="resume-icon"><IconFile /></span>
                    <div>
                      <p className="resume-filename">{profile.resumeFileName}</p>
                      <p className="resume-meta">Uploaded resume</p>
                    </div>
                  </div>
                  <div className="resume-actions">
                    <button className="secondary-button" onClick={handleResumeDownload} type="button"><IconDownload /> Download</button>
                    <button className="danger-button-small" onClick={handleResumeDelete} type="button"><IconTrash /> Delete</button>
                  </div>
                </div>
              ) : (
                <div className="resume-empty">
                  <p className="resume-empty-text">No resume uploaded yet. Upload your resume to keep it handy for job applications.</p>
                </div>
              )}
              <div className="resume-upload-section">
                <label className="resume-upload-label">
                  <input accept=".pdf,.doc,.docx" className="resume-upload-input" disabled={uploadingResume} onChange={handleResumeUpload} type="file" />
                  <span className="resume-upload-button">{uploadingResume ? "Uploading..." : profile.resumeFileName ? "Replace Resume" : "Upload Resume"}</span>
                </label>
                <p className="resume-upload-hint">Supported formats: PDF, DOC, DOCX (Max 5MB)</p>
              </div>
              {resumeError && <div className="auth-banner auth-banner--error">{resumeError}</div>}
              {resumeMessage && <div className="auth-banner auth-banner--success">{resumeMessage}</div>}
            </div>
          </section>

          {/* Change Password */}
          <section className="profile-section-card">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon"><IconLock /></span>
                <h2 className="section-title-main">Change password</h2>
              </div>
            </div>
            <form className="profile-edit-form" onSubmit={handlePasswordChange}>
              <label className="profile-field-inline">
                <span>CURRENT PASSWORD</span>
                <input className="profile-input-inline" onChange={(e) => setPasswordForm((c) => ({ ...c, currentPassword: e.target.value }))} placeholder="Enter current password" type="password" value={passwordForm.currentPassword} />
              </label>
              <label className="profile-field-inline">
                <span>NEW PASSWORD</span>
                <input className="profile-input-inline" minLength={8} onChange={(e) => setPasswordForm((c) => ({ ...c, newPassword: e.target.value }))} placeholder="Min. 8 characters" type="password" value={passwordForm.newPassword} />
              </label>
              <label className="profile-field-inline">
                <span>CONFIRM NEW PASSWORD</span>
                <input className="profile-input-inline" minLength={8} onChange={(e) => setPasswordForm((c) => ({ ...c, confirmPassword: e.target.value }))} placeholder="Repeat new password" type="password" value={passwordForm.confirmPassword} />
              </label>
              {passwordError && <div className="auth-banner auth-banner--error">{passwordError}</div>}
              {passwordMessage && <div className="auth-banner auth-banner--success">{passwordMessage}</div>}
              <button className="primary-button" disabled={changingPassword} type="submit">{changingPassword ? "Updating..." : "Update password"}</button>
            </form>
          </section>

          {/* Danger Zone */}
          <section className="profile-section-card danger-zone">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon"><IconWarning /></span>
                <h2 className="section-title-main">Danger zone</h2>
              </div>
            </div>
            <p className="danger-text">Permanently delete your account and all saved applications. This cannot be undone.</p>
            <button className="danger-button" onClick={handleDeleteAccount} type="button">Delete my account</button>
          </section>

        </div>
      </main>
    </div>
  );
}
