"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";

export default function HelpPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createBrowserSupabaseClient();
  });

  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [userLabel, setUserLabel] = useState("Guest");

  useEffect(() => {
    if (!supabase) return;

    async function checkAuth() {
      if (!supabase) return;
      
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        router.replace("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();

      const fullName = profileData?.full_name || session.user.user_metadata.full_name || "";
      setUserLabel(fullName || session.user.email || "Trackr user");

      setLoading(false);
    }

    checkAuth();
  }, [supabase, router]);

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading || !supabase) {
    return (
      <main className="route-loader">
        <div className="route-loader__pulse" />
        <p>Loading Help...</p>
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
          <section className="profile-section-card">
            <div className="section-header">
              <div className="section-header-left">
                <span className="section-icon">❓</span>
                <h2 className="section-title-main">Help & FAQ</h2>
              </div>
            </div>

            <p style={{ marginBottom: "1.5rem", color: "var(--text-muted)" }}>
              Find answers to common questions about using Trackr. Click on any question to expand the answer.
            </p>

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
                  a: 'Go to your profile page by clicking the user avatar in the top right corner and selecting "Profile". Click the "Edit" button in the Personal Information section. You can update your first name, surname, and phone number. Click "Save changes" when done. Note: Your email address cannot be changed for security reasons.',
                },
                {
                  q: "How do I change my password?",
                  a: 'Navigate to your profile page and scroll to the "Change password" section. Enter your current password, then your new password twice to confirm. Your new password must be at least 8 characters long. Click "Update password" to save the changes.',
                },
                {
                  q: "Can I switch between light and dark mode?",
                  a: 'Yes! Look for the theme toggle button (☀️/🌙) in the top right corner of the dashboard header. Click it to instantly switch between themes. Your preference is saved automatically and will persist across sessions.',
                },
                {
                  q: "Is my data stored securely?",
                  a: "Absolutely! All your data is stored in Supabase, a secure PostgreSQL database with enterprise-grade security. We use Row Level Security (RLS) policies to ensure you can only access your own data. Your uploaded documents are stored in encrypted storage buckets. Your password is hashed and never stored in plain text.",
                },
                {
                  q: "Can I export my application data?",
                  a: 'Yes! Click the "📊 Export to Excel" button on the dashboard (next to "Add application"). This will download an Excel file containing all your applications with complete details including company, role, status, dates, and document information.',
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
                  q: "How do I use the ATS Checker tool?",
                  a: 'Go to Tools → ATS Checker. Upload your CV (PDF) or paste the text, then paste the job description. Click "Analyze ATS Score" to get a compatibility score, matched/missing keywords, and suggestions to improve your CV for that specific job.',
                },
                {
                  q: "How do I use the Cover Letter Generator?",
                  a: 'Go to Tools → Cover Letter Generator. Upload your CV (PDF), then paste the job description. Click "Generate Cover Letter" to create a tailored cover letter. You can copy or download the generated letter.',
                },
                {
                  q: "How do I use the Resume Optimizer?",
                  a: 'Go to Tools → Resume Optimizer. Upload your CV (PDF) and paste the job description. Click "Analyze & Get Suggestions" to receive personalized optimization tips, missing keywords, and a match score to improve your resume for the specific role.',
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
        </div>
      </main>
    </div>
  );
}
