"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function AboutPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createBrowserSupabaseClient();
  });

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    async function checkAuth() {
      if (!supabase) return;
      
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsAuthenticated(!!session?.user);
      setLoading(false);
    }

    checkAuth();
  }, [supabase, router]);

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="route-loader">
        <div className="route-loader__pulse" />
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand-mark brand-mark--small" href={isAuthenticated ? "/dashboard" : "/"}>
          <span className="brand-mark__icon">T</span>
          <div>
            <p className="brand-mark__eyebrow">Trackr</p>
            <strong>Application tracker</strong>
          </div>
        </Link>

        {isAuthenticated ? (
          <>
            <nav className="dashboard-tabs">
              <Link href="/dashboard" className="tab-link">
                📊 Applications
              </Link>
              <Link href="/tools" className="tab-link">
                🛠️ Tools
              </Link>
              <Link href="/profile" className="tab-link">
                👤 Profile
              </Link>
              <Link href="/about" className="tab-link active">
                ℹ️ About
              </Link>
            </nav>

            <div className="dashboard-header__actions">
              <button className="secondary-button" onClick={handleSignOut} type="button">
                Sign out
              </button>
            </div>
          </>
        ) : (
          <div className="dashboard-header__actions">
            <Link href="/about" className="tab-link active">
              ℹ️ About
            </Link>
            <Link href="/login" className="secondary-button">
              Sign in
            </Link>
            <Link href="/register" className="primary-button">
              Get Started
            </Link>
          </div>
        )}
      </header>

      <main className="dashboard-main">
        <div className="about-layout">
          {/* Hero Section */}
          <section className="about-hero">
            <div className="about-hero-icon">T</div>
            <h1 className="about-hero-title">About Trackr</h1>
            <p className="about-hero-subtitle">
              Your all-in-one job application tracking and optimization platform
            </p>
          </section>

          {/* Mission Section */}
          <section className="about-section">
            <div className="about-card">
              <div className="about-card-icon">🎯</div>
              <h2 className="about-card-title">Our Mission</h2>
              <p className="about-card-text">
                Trackr was built to simplify and streamline the job search process. We understand that 
                finding the right job can be overwhelming, with countless applications to manage, 
                documents to organize, and deadlines to track. Our mission is to empower job seekers 
                with the tools they need to stay organized, optimize their applications, and land their dream job.
              </p>
            </div>
          </section>

          {/* What We Offer */}
          <section className="about-section">
            <h2 className="about-section-title">What We Offer</h2>
            <div className="about-features-grid">
              <div className="about-feature-card">
                <div className="feature-icon">📊</div>
                <h3>Application Tracking</h3>
                <p>
                  Keep all your job applications organized in one place. Track status, dates, 
                  companies, and more with our intuitive dashboard.
                </p>
              </div>

              <div className="about-feature-card">
                <div className="feature-icon">📈</div>
                <h3>ATS Score Checker</h3>
                <p>
                  Analyze how well your CV matches job descriptions. Get actionable insights 
                  to improve your chances of passing Applicant Tracking Systems.
                </p>
              </div>

              <div className="about-feature-card">
                <div className="feature-icon">📝</div>
                <h3>Resume Builder</h3>
                <p>
                  Create professional, ATS-friendly resumes with our easy-to-use builder. 
                  Clean formatting that passes tracking systems.
                </p>
              </div>

              <div className="about-feature-card">
                <div className="feature-icon">✉️</div>
                <h3>Cover Letter Generator</h3>
                <p>
                  Generate personalized, professional cover letters in minutes. 
                  Tailored to each job application with proper business formatting.
                </p>
              </div>

              <div className="about-feature-card">
                <div className="feature-icon">📄</div>
                <h3>Document Management</h3>
                <p>
                  Upload and manage your CVs and cover letters for each application. 
                  Download them anytime you need.
                </p>
              </div>

              <div className="about-feature-card">
                <div className="feature-icon">🔒</div>
                <h3>Secure & Private</h3>
                <p>
                  Your data is stored securely with enterprise-grade encryption. 
                  Row-level security ensures only you can access your information.
                </p>
              </div>
            </div>
          </section>

          {/* Why Choose Trackr */}
          <section className="about-section">
            <div className="about-card highlight-card">
              <h2 className="about-card-title">Why Choose Trackr?</h2>
              <div className="about-list">
                <div className="about-list-item">
                  <span className="list-icon">✓</span>
                  <div>
                    <strong>All-in-One Platform</strong>
                    <p>Everything you need for your job search in one place - no more juggling multiple tools.</p>
                  </div>
                </div>

                <div className="about-list-item">
                  <span className="list-icon">✓</span>
                  <div>
                    <strong>AI-Powered Tools</strong>
                    <p>Leverage intelligent tools to optimize your applications and stand out from the competition.</p>
                  </div>
                </div>

                <div className="about-list-item">
                  <span className="list-icon">✓</span>
                  <div>
                    <strong>Real-Time Sync</strong>
                    <p>Access your data from any device, anywhere. Changes sync instantly across all platforms.</p>
                  </div>
                </div>

                <div className="about-list-item">
                  <span className="list-icon">✓</span>
                  <div>
                    <strong>User-Friendly Interface</strong>
                    <p>Clean, intuitive design that makes managing applications effortless and enjoyable.</p>
                  </div>
                </div>

                <div className="about-list-item">
                  <span className="list-icon">✓</span>
                  <div>
                    <strong>Free to Use</strong>
                    <p>Core features are completely free. No hidden fees, no credit card required.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Technology Stack */}
          <section className="about-section">
            <h2 className="about-section-title">Built With Modern Technology</h2>
            <div className="tech-stack-grid">
              <div className="tech-card">
                <div className="tech-icon">⚛️</div>
                <h4>Next.js</h4>
                <p>React framework for production</p>
              </div>

              <div className="tech-card">
                <div className="tech-icon">🗄️</div>
                <h4>Supabase</h4>
                <p>PostgreSQL database & auth</p>
              </div>

              <div className="tech-card">
                <div className="tech-icon">🎨</div>
                <h4>TypeScript</h4>
                <p>Type-safe development</p>
              </div>

              <div className="tech-card">
                <div className="tech-icon">🔐</div>
                <h4>Row-Level Security</h4>
                <p>Enterprise-grade protection</p>
              </div>
            </div>
          </section>

          {/* Statistics */}
          <section className="about-section">
            <div className="stats-showcase">
              <div className="stat-showcase-item">
                <div className="stat-number">6</div>
                <div className="stat-label">Application Statuses</div>
              </div>

              <div className="stat-showcase-item">
                <div className="stat-number">3</div>
                <div className="stat-label">AI-Powered Tools</div>
              </div>

              <div className="stat-showcase-item">
                <div className="stat-number">∞</div>
                <div className="stat-label">Applications to Track</div>
              </div>

              <div className="stat-showcase-item">
                <div className="stat-number">100%</div>
                <div className="stat-label">Free Core Features</div>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          {!isAuthenticated && (
            <section className="about-section">
              <div className="about-cta">
                <h2>Ready to Organize Your Job Search?</h2>
                <p>Join Trackr today and take control of your job application process.</p>
                <div className="cta-buttons">
                  <Link href="/register" className="primary-button cta-button">
                    Get Started Free
                  </Link>
                  <Link href="/login" className="secondary-button cta-button">
                    Sign In
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* Footer */}
          <section className="about-footer">
            <p>© 2026 Trackr. Built with ❤️ for job seekers everywhere.</p>
            <div className="footer-links">
              <Link href="/about">About</Link>
              <span>•</span>
              {isAuthenticated ? (
                <Link href="/profile">Profile</Link>
              ) : (
                <Link href="/login">Sign In</Link>
              )}
              <span>•</span>
              {isAuthenticated ? (
                <Link href="/tools">Tools</Link>
              ) : (
                <Link href="/register">Get Started</Link>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
