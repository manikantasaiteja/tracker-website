"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

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

export default function ProfilePage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createBrowserSupabaseClient();
  });

  const [profile, setProfile] = useState<UserProfile>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    resumeFileName: null,
    resumeFileUrl: null,
  });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState("Guest");

  useEffect(() => {
    if (!supabase) return;

    async function loadProfile() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase!.auth.getSession();

        if (sessionError || !session?.user) {
          router.replace("/login");
          return;
        }

        setUserId(session.user.id);

        // Get user profile from user_profiles table
        const { data: profileData, error: profileError } = await supabase!
          .from("user_profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        const fullName = profileData?.full_name || session.user.user_metadata.full_name || "";
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        setUserLabel(fullName || session.user.email || "Trackr user");
        setProfile({
          firstName,
          lastName,
          email: session.user.email || "",
          phoneNumber: profileData?.phone_number || "",
          resumeFileName: profileData?.resume_file_name || null,
          resumeFileUrl: profileData?.resume_file_url || null,
        });
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [supabase, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) {
      setError("Unable to save profile. Please try again.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const fullName = `${profile.firstName} ${profile.lastName}`.trim();

      // Update user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
        },
      });

      if (metadataError) {
        throw metadataError;
      }

      // Update or insert user profile
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert({
          id: userId,
          full_name: fullName,
          phone_number: profile.phoneNumber,
        });

      if (profileError) {
        throw profileError;
      }

      setMessage("Profile updated successfully!");
      setEditingProfile(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setPasswordError("Unable to change password. Please try again.");
      return;
    }

    setPasswordError(null);
    setPasswordMessage(null);

    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    // Validate password length
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }

    setChangingPassword(true);

    try {
      // Supabase doesn't verify current password, so we update directly
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setPasswordMessage("Password updated successfully!");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (caughtError) {
      setPasswordError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update password.",
      );
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted."
    );
    
    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      "This is your last chance. Are you absolutely sure you want to delete your account?"
    );

    if (!doubleConfirm || !supabase || !userId) return;

    try {
      // Delete user data (RLS policies will handle cascade)
      await supabase.from("applications").delete().eq("user_id", userId);
      await supabase.from("user_profiles").delete().eq("id", userId);
      
      // Sign out
      await supabase.auth.signOut();
      router.replace("/");
    } catch (err) {
      setError("Failed to delete account. Please contact support.");
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleResumeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !supabase) return;

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      setResumeError("Invalid file type. Only PDF, DOC, and DOCX are allowed.");
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setResumeError("File size exceeds 5MB limit.");
      return;
    }

    setUploadingResume(true);
    setResumeError(null);
    setResumeMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/resume/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Show detailed error message
        console.error("Upload error details:", data);
        throw new Error(data.error || `Upload failed with status ${response.status}`);
      }

      setProfile((current) => ({
        ...current,
        resumeFileName: data.fileName,
        resumeFileUrl: data.fileUrl,
      }));

      setResumeMessage("Resume uploaded successfully!");
    } catch (err) {
      console.error("Resume upload error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to upload resume";
      
      // Provide helpful error messages
      if (errorMessage.includes("bucket")) {
        setResumeError(
          "Storage not configured. Please run the setup script in Supabase. See RESUME_UPLOAD_FIX.md for instructions."
        );
      } else if (errorMessage.includes("policy")) {
        setResumeError(
          "Storage permissions not set. Please run the setup script in Supabase. See RESUME_UPLOAD_FIX.md for instructions."
        );
      } else {
        setResumeError(errorMessage);
      }
    } finally {
      setUploadingResume(false);
      // Reset file input
      event.target.value = "";
    }
  }

  async function handleResumeDownload() {
    if (!supabase || !profile.resumeFileUrl) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      const response = await fetch("/api/resume/download", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download resume");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = profile.resumeFileName || "resume.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setResumeError(
        err instanceof Error ? err.message : "Failed to download resume"
      );
    }
  }

  async function handleResumeDelete() {
    if (!supabase || !profile.resumeFileUrl) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete your resume? This action cannot be undone."
    );

    if (!confirmed) return;

    setResumeError(null);
    setResumeMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      const response = await fetch("/api/resume/delete", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete resume");
      }

      setProfile((current) => ({
        ...current,
        resumeFileName: null,
        resumeFileUrl: null,
      }));

      setResumeMessage("Resume deleted successfully!");
    } catch (err) {
      setResumeError(
        err instanceof Error ? err.message : "Failed to delete resume"
      );
    }
  }

  if (loading || !supabase) {
    return (
      <main className="route-loader">
        <div className="route-loader__pulse" />
        <p>Loading profile...</p>
      </main>
    );
  }

  return (
    <div className="dashboard-shell">
      <DashboardHeader
        userLabel={userLabel}
        onSignOut={handleSignOut}
      />

      <main className="dashboard-main">
        <div className="profile-layout">
          {/* Profile Header Card */}
          <section className="profile-header-card">
            <div className="profile-avatar-large">
              {profile.firstName.charAt(0).toUpperCase() || "U"}
              {profile.lastName.charAt(0).toUpperCase() || ""}
            </div>
            <div>
              <h1 className="profile-name">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="profile-email">{profile.email}</p>
              <p className="profile-phone">{profile.phoneNumber || "No phone number"}</p>
            </div>
          </section>

          {/* Personal Information */}
          <section className="profile-section-card">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon">👤</span>
                <h2 className="section-title-main">Personal information</h2>
              </div>
              {!editingProfile ? (
                <button
                  className="edit-button"
                  onClick={() => setEditingProfile(true)}
                  type="button"
                >
                  ✏️ Edit
                </button>
              ) : null}
            </div>

            {editingProfile ? (
              <form className="profile-edit-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <label className="profile-field-inline">
                    <span>FIRST NAME</span>
                    <input
                      className="profile-input-inline"
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                      required
                      type="text"
                      value={profile.firstName}
                    />
                  </label>

                  <label className="profile-field-inline">
                    <span>SURNAME</span>
                    <input
                      className="profile-input-inline"
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                      required
                      type="text"
                      value={profile.lastName}
                    />
                  </label>
                </div>

                <label className="profile-field-inline">
                  <span>EMAIL ADDRESS</span>
                  <input
                    className="profile-input-inline"
                    disabled
                    type="email"
                    value={profile.email}
                  />
                </label>

                <label className="profile-field-inline">
                  <span>PHONE NUMBER</span>
                  <PhoneInput
                    className="profile-input-inline phone-input"
                    defaultCountry="US"
                    international
                    onChange={(value) =>
                      setProfile((current) => ({
                        ...current,
                        phoneNumber: value || "",
                      }))
                    }
                    value={profile.phoneNumber}
                  />
                </label>

                {error ? (
                  <div className="auth-banner auth-banner--error">{error}</div>
                ) : null}
                {message ? (
                  <div className="auth-banner auth-banner--success">{message}</div>
                ) : null}

                <div className="form-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setEditingProfile(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    disabled={saving}
                    type="submit"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-info-grid">
                <div className="info-item">
                  <span className="info-label">FIRST NAME</span>
                  <span className="info-value">{profile.firstName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">SURNAME</span>
                  <span className="info-value">{profile.lastName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">EMAIL ADDRESS</span>
                  <span className="info-value">{profile.email}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">PHONE NUMBER</span>
                  <span className="info-value">{profile.phoneNumber || "Not set"}</span>
                </div>
              </div>
            )}
          </section>

          {/* Resume Management */}
          <section className="profile-section-card">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon">📄</span>
                <h2 className="section-title-main">Resume</h2>
              </div>
            </div>

            <div className="resume-section">
              {profile.resumeFileName ? (
                <div className="resume-uploaded">
                  <div className="resume-info">
                    <span className="resume-icon">📄</span>
                    <div>
                      <p className="resume-filename">{profile.resumeFileName}</p>
                      <p className="resume-meta">Uploaded resume</p>
                    </div>
                  </div>
                  <div className="resume-actions">
                    <button
                      className="secondary-button"
                      onClick={handleResumeDownload}
                      type="button"
                    >
                      ⬇️ Download
                    </button>
                    <button
                      className="danger-button-small"
                      onClick={handleResumeDelete}
                      type="button"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="resume-empty">
                  <p className="resume-empty-text">
                    No resume uploaded yet. Upload your resume to keep it handy for job applications.
                  </p>
                </div>
              )}

              <div className="resume-upload-section">
                <label className="resume-upload-label">
                  <input
                    accept=".pdf,.doc,.docx"
                    className="resume-upload-input"
                    disabled={uploadingResume}
                    onChange={handleResumeUpload}
                    type="file"
                  />
                  <span className="resume-upload-button">
                    {uploadingResume ? "Uploading..." : profile.resumeFileName ? "Replace Resume" : "Upload Resume"}
                  </span>
                </label>
                <p className="resume-upload-hint">
                  Supported formats: PDF, DOC, DOCX (Max 5MB)
                </p>
              </div>

              {resumeError ? (
                <div className="auth-banner auth-banner--error">{resumeError}</div>
              ) : null}
              {resumeMessage ? (
                <div className="auth-banner auth-banner--success">{resumeMessage}</div>
              ) : null}
            </div>
          </section>

          {/* Change Password */}
          <section className="profile-section-card">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon">🔒</span>
                <h2 className="section-title-main">Change password</h2>
              </div>
            </div>

            <form className="profile-edit-form" onSubmit={handlePasswordChange}>
              <label className="profile-field-inline">
                <span>CURRENT PASSWORD</span>
                <input
                  className="profile-input-inline"
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                  placeholder="Enter current password"
                  type="password"
                  value={passwordForm.currentPassword}
                />
              </label>

              <label className="profile-field-inline">
                <span>NEW PASSWORD</span>
                <input
                  className="profile-input-inline"
                  minLength={8}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }))
                  }
                  placeholder="Min. 8 characters"
                  type="password"
                  value={passwordForm.newPassword}
                />
              </label>

              <label className="profile-field-inline">
                <span>CONFIRM NEW PASSWORD</span>
                <input
                  className="profile-input-inline"
                  minLength={8}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  placeholder="Repeat new password"
                  type="password"
                  value={passwordForm.confirmPassword}
                />
              </label>

              {passwordError ? (
                <div className="auth-banner auth-banner--error">{passwordError}</div>
              ) : null}
              {passwordMessage ? (
                <div className="auth-banner auth-banner--success">{passwordMessage}</div>
              ) : null}

              <button
                className="primary-button"
                disabled={changingPassword}
                type="submit"
              >
                {changingPassword ? "Updating..." : "Update password"}
              </button>
            </form>
          </section>

          {/* Danger Zone */}
          <section className="profile-section-card danger-zone">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon">⚠️</span>
                <h2 className="section-title-main">Danger zone</h2>
              </div>
            </div>

            <p className="danger-text">
              Permanently delete your account and all saved applications. This cannot be undone.
            </p>

            <button
              className="danger-button"
              onClick={handleDeleteAccount}
              type="button"
            >
              Delete my account
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
