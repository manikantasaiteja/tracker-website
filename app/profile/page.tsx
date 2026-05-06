"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
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
      <header className="dashboard-header">
        <Link className="brand-mark brand-mark--small" href="/dashboard">
          <span className="brand-mark__icon">T</span>
          <div>
            <p className="brand-mark__eyebrow">Trackr</p>
            <strong>Application tracker</strong>
          </div>
        </Link>

        <nav className="dashboard-tabs">
          <Link href="/dashboard" className="tab-link">
            📊 Applications
          </Link>
          <Link href="/tools" className="tab-link">
            🛠️ Tools
          </Link>
          <Link href="/profile" className="tab-link active">
            👤 Profile
          </Link>
          <Link href="/about" className="tab-link">
            ℹ️ About
          </Link>
        </nav>

        <div className="dashboard-header__actions">
          <button className="secondary-button" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </header>

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

          {/* Help & FAQ */}
          <section className="profile-section-card">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon">❓</span>
                <h2 className="section-title-main">Help & FAQ</h2>
              </div>
            </div>

            <div className="faq-list">
              {[
                {
                  q: "How do I add a new job application?",
                  a: 'Click the "Add application" button on the dashboard. Fill in the required fields: Company name, Role/Position, and Date Applied. You can also add optional information like Location, Job URL, and upload your CV and Cover Letter. Click "Create entry" to save your application.',
                },
                {
                  q: "How do I update the status of an application?",
                  a: "Simply click on the status badge (e.g., 'Applied') in the applications table. It will automatically cycle through the stages: Applied → Interview → Offer → Rejected → Ghosted → Withdrawn. This makes it easy to track your application progress with a single click.",
                },
                {
                  q: "Can I attach my CV and cover letter to an application?",
                  a: 'Yes! When adding or editing an application, scroll down to find the CV and Cover Letter upload sections. Click "Choose File" to select your document (PDF, DOC, or DOCX formats supported). Once uploaded, you can download these documents anytime by clicking the file name in the table. Each application can have its own unique CV and cover letter.',
                },
                {
                  q: "How do I download my uploaded CV or cover letter?",
                  a: "In the applications table, look for the CV and Cover Letter columns. If you've uploaded documents, you'll see the filename with an emoji icon (📄 for CV, 📝 for Cover Letter). Simply click on the filename to download the document to your computer.",
                },
                {
                  q: "Can I edit an existing application?",
                  a: 'Yes! Click the "Edit" button in the Actions column of any application row. This opens the same form you used to create the application, pre-filled with the current data. Make your changes and click "Save changes" to update the application.',
                },
                {
                  q: "How do I delete an application?",
                  a: 'Click the "Delete" button in the Actions column of the application you want to remove. You\'ll be asked to confirm the deletion. Note: This action cannot be undone, and any uploaded documents associated with that application will also be deleted.',
                },
                {
                  q: "Can I search and filter my applications?",
                  a: "Yes! Use the search bar at the top of the applications table to search by company name, role, or location. You can also use the status dropdown filter to view only applications with a specific status (Applied, Interview, Offer, etc.). Combine both for more precise filtering.",
                },
                {
                  q: "What do the different status badges mean?",
                  a: "Applied (blue): You've submitted your application. Interview (yellow): You've been invited to interview. Offer (green): You've received a job offer. Rejected (red): Your application was declined. Ghosted (gray): No response from the company. Withdrawn (purple): You withdrew your application.",
                },
                {
                  q: "How do I change my profile information?",
                  a: 'Go to your profile page by clicking your name in the dashboard header. Click the "Edit" button in the Personal Information section. You can update your first name, surname, and phone number. Click "Save changes" when done. Note: Your email address cannot be changed for security reasons.',
                },
                {
                  q: "How do I change my password?",
                  a: 'Navigate to your profile page and scroll to the "Change password" section. Enter your current password, then your new password twice to confirm. Your new password must be at least 8 characters long. Click "Update password" to save the changes.',
                },
                {
                  q: "Can I switch between light and dark mode?",
                  a: 'Yes! Look for the theme toggle button in the dashboard header (it says "Light mode" or "Dark mode" depending on your current theme). Click it to instantly switch between themes. Your preference is saved automatically and will persist across sessions.',
                },
                {
                  q: "Is my data stored securely?",
                  a: "Absolutely! All your data is stored in Supabase, a secure PostgreSQL database with enterprise-grade security. We use Row Level Security (RLS) policies to ensure you can only access your own data. Your uploaded documents are stored in encrypted storage buckets. Your password is hashed and never stored in plain text.",
                },
                {
                  q: "Can I export my application data?",
                  a: "Currently, there's no built-in export feature, but you can manually copy your data from the table. We're planning to add CSV/Excel export functionality in a future update so you can easily backup or analyze your application history.",
                },
                {
                  q: "What file formats are supported for CV and cover letter uploads?",
                  a: "You can upload documents in PDF (.pdf), Microsoft Word (.doc), and Microsoft Word (.docx) formats. These are the most common formats accepted by employers. Make sure your files are under 5MB for optimal upload performance.",
                },
                {
                  q: "How many applications can I track?",
                  a: "There's no limit! You can track as many job applications as you need. The dashboard shows statistics for all your applications, and you can use search and filters to manage large numbers of applications efficiently.",
                },
                {
                  q: "What happens if I forget my password?",
                  a: 'On the login page, click the "Forgot password?" link below the password field. Enter your email address and you\'ll receive a password reset link. Click the link in the email to set a new password. The reset link expires after a certain time for security.',
                },
                {
                  q: "Can I access Trackr from multiple devices?",
                  a: "Yes! Trackr is a web application, so you can access it from any device with a web browser (computer, tablet, or phone). Your data is synced in real-time across all devices. Just log in with your email and password.",
                },
                {
                  q: "How do I change my profile photo?",
                  a: "Profile photos are automatically generated from your initials (first letter of your first name and surname). This creates a unique, colorful avatar for each user. Custom photo uploads are not currently supported, but may be added in future updates.",
                },
                {
                  q: "What should I do if I encounter an error?",
                  a: "Most errors will display a message explaining what went wrong. Common issues include network problems or invalid data. Try refreshing the page or logging out and back in. If the problem persists, check your internet connection. For persistent issues, contact support.",
                },
                {
                  q: "Can I undo a status change?",
                  a: "Yes! If you accidentally click a status badge and change the status, simply click it again to cycle through to the correct status. You can also use the Edit button to manually select any status from the dropdown menu.",
                },
              ].map((faq, index) => (
                <div key={index} className="faq-item">
                  <button
                    className="faq-question"
                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                    type="button"
                  >
                    <span>{faq.q}</span>
                    <span className="faq-icon">{expandedFaq === index ? "−" : "+"}</span>
                  </button>
                  {expandedFaq === index ? (
                    <div className="faq-answer">{faq.a}</div>
                  ) : null}
                </div>
              ))}
            </div>
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
