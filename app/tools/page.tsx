"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function ToolsPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createBrowserSupabaseClient();
  });

  const [loading, setLoading] = useState(true);

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
        <p>Loading tools...</p>
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
          <Link href="/tools" className="tab-link active">
            🛠️ Tools
          </Link>
          <Link href="/profile" className="tab-link">
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
        <div className="tools-layout">
          <section className="tools-hero">
            <h1 className="tools-title">🛠️ Tools</h1>
            <p className="tools-subtitle">
              Optimize your job applications with our powerful tools
            </p>
          </section>

          <div className="tools-grid">
            {/* ATS Score Checker Card */}
            <Link href="/tools/ats-checker" className="tool-option-card">
              <div className="tool-option-icon">📊</div>
              <h2 className="tool-option-title">ATS Score Checker</h2>
              <p className="tool-option-description">
                Analyze how well your CV matches a job description and get actionable suggestions to improve your ATS compatibility score.
              </p>
              <div className="tool-option-features">
                <span className="feature-tag">✓ Keyword Analysis</span>
                <span className="feature-tag">✓ Match Score</span>
                <span className="feature-tag">✓ Suggestions</span>
              </div>
              <div className="tool-option-cta">
                Launch Tool →
              </div>
            </Link>

            {/* AI Resume Optimizer Card */}
            <Link href="/tools/resume-builder" className="tool-option-card">
              <div className="tool-option-icon">🎯</div>
              <h2 className="tool-option-title">AI Resume Optimizer</h2>
              <p className="tool-option-description">
                Upload your existing CV and job description to get intelligent, personalized suggestions for tailoring your resume to specific roles.
              </p>
              <div className="tool-option-features">
                <span className="feature-tag">✓ PDF Upload</span>
                <span className="feature-tag">✓ AI Suggestions</span>
                <span className="feature-tag">✓ Job Matching</span>
              </div>
              <div className="tool-option-cta">
                Launch Tool →
              </div>
            </Link>

            {/* Resume Builder from Scratch Card */}
            <Link href="/tools/resume-builder/create" className="tool-option-card">
              <div className="tool-option-icon">✏️</div>
              <h2 className="tool-option-title">Resume Builder</h2>
              <p className="tool-option-description">
                Build a professional resume from scratch with live preview. Customize fonts, colors, spacing, and see changes in real-time as you type.
              </p>
              <div className="tool-option-features">
                <span className="feature-tag">✓ Live Preview</span>
                <span className="feature-tag">✓ Customizable</span>
                <span className="feature-tag">✓ From Scratch</span>
              </div>
              <div className="tool-option-cta">
                Launch Tool →
              </div>
            </Link>

            {/* Cover Letter Generator Card */}
            <Link href="/tools/cover-letter" className="tool-option-card">
              <div className="tool-option-icon">✉️</div>
              <h2 className="tool-option-title">Cover Letter Generator</h2>
              <p className="tool-option-description">
                Create professional, personalized cover letters in minutes. Just fill in your details and generate a polished letter.
              </p>
              <div className="tool-option-features">
                <span className="feature-tag">✓ Professional Format</span>
                <span className="feature-tag">✓ Customizable</span>
                <span className="feature-tag">✓ Download/Copy</span>
              </div>
              <div className="tool-option-cta">
                Launch Tool →
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
