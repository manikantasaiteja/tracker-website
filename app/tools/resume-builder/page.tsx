"use client";

import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";

type Suggestion = {
  section: string;
  type: "add" | "improve" | "remove" | "reorder";
  priority: "high" | "medium" | "low";
  suggested: string;
  reason: string;
};

type AnalysisResult = {
  matchScore: number;
  missingKeywords: string[];
  suggestions: Suggestion[];
  summary: string;
};

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), useWorkerFetch: false }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str || "").join(" ") + "\n";
  }
  if (!text.trim()) throw new Error("No text could be extracted from the PDF. It may be image-based.");
  return text.trim();
}

export default function ResumeBuilderPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() =>
    typeof window !== "undefined" ? createBrowserSupabaseClient() : null
  );

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState("Guest");

  useEffect(() => {
    if (!supabase) return;
    async function checkAuth() {
      const { data: { session }, error: sessionError } = await supabase!.auth.getSession();
      if (sessionError || !session?.user) { router.replace("/login"); return; }
      const { data: profileData } = await supabase!.from("user_profiles").select("full_name").eq("id", session.user.id).single();
      setUserLabel(profileData?.full_name || session.user.email || "Trackr user");
      setLoading(false);
    }
    checkAuth();
  }, [supabase, router]);

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleCVUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setCvFile(file); setError(null); setExtracting(true);
    try {
      setCvText(await extractTextFromPDF(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract PDF text.");
      setCvFile(null); setCvText("");
    } finally { setExtracting(false); }
  }

  async function analyzeResume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cvText.trim() || !jobDescription.trim()) {
      setError("Please upload your CV and provide the job description."); return;
    }
    setAnalyzing(true); setError(null); setResult(null);
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tool: "resume", cvText, jobDescription }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI analysis failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally { setAnalyzing(false); }
  }

  if (loading || !supabase) {
    return <main className="route-loader"><div className="route-loader__pulse" /><p>Loading Resume Optimizer...</p></main>;
  }

  return (
    <div className="dashboard-shell">
      <DashboardHeader userLabel={userLabel} onSignOut={handleSignOut} />
      <main className="dashboard-main">
        <div className="resume-builder-layout">
          <section className="tool-card">
            <div className="tool-header">
              <div className="tool-icon-svg">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div>
                <h2 className="tool-title">AI Resume Optimizer</h2>
                <p className="tool-description">
                  Upload your CV and paste a job description. Gemini AI gives you a match score, identifies missing keywords, and provides section-by-section suggestions to tailor your resume for the role.
                </p>
              </div>
            </div>

            <form className="ats-form" onSubmit={analyzeResume}>
              <div className="ats-input-group">
                <label className="ats-label">
                  <span className="label-text">
                    <strong className="required-field">Upload Your CV (PDF)</strong>
                    <span className="label-hint">PDF only · Max 10MB</span>
                  </span>
                  <div className="file-upload-zone">
                    <input type="file" accept=".pdf" onChange={handleCVUpload} className="file-input-hidden" id="cv-upload-optimizer" />
                    <label htmlFor="cv-upload-optimizer" className="file-upload-label">
                      {extracting
                        ? <><span className="upload-icon">⏳</span><span className="upload-text">Extracting text...</span></>
                        : cvFile
                        ? <><span className="upload-icon">✅</span><span className="upload-text"><strong>{cvFile.name}</strong><span className="file-size">{cvText.length} characters extracted</span></span></>
                        : <><span className="upload-icon">📄</span><span className="upload-text"><strong>Click to upload your CV</strong><span className="file-hint">PDF format only</span></span></>}
                    </label>
                  </div>
                </label>

                <label className="ats-label">
                  <span className="label-text">
                    <strong className="required-field">Job Description</strong>
                    <span className="label-hint">Paste the complete job posting</span>
                  </span>
                  <textarea className="ats-textarea" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the full job description here..." rows={12} required />
                  <span className="char-count">{jobDescription.length} characters</span>
                </label>
              </div>

              {error && <div className="auth-banner auth-banner--error">{error}</div>}

              <button className="primary-button analyze-button" type="submit"
                disabled={analyzing || extracting || !cvText || !jobDescription}>
                {analyzing ? "Analysing with AI..." : "Analyse & Get Suggestions"}
              </button>
            </form>

            {result && (
              <div className="optimization-results">
                {/* Match Score */}
                <div className="score-section">
                  <div className="score-circle">
                    <svg viewBox="0 0 100 100" className="score-svg">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border-strong)" strokeWidth="8" />
                      <circle cx="50" cy="50" r="45" fill="none"
                        stroke={result.matchScore >= 75 ? "var(--success)" : result.matchScore >= 60 ? "#ffc454" : "var(--danger)"}
                        strokeWidth="8" strokeDasharray={`${result.matchScore * 2.827} 283`}
                        strokeLinecap="round" transform="rotate(-90 50 50)" />
                    </svg>
                    <div className="score-text">
                      <span className="score-number">{result.matchScore}</span>
                      <span className="score-label">Match Score</span>
                    </div>
                  </div>
                  <div className="score-interpretation">
                    <h3>{result.matchScore >= 75 ? "Strong Match" : result.matchScore >= 60 ? "Good Foundation" : "Needs Optimisation"}</h3>
                    <p className="ai-summary">{result.summary}</p>
                  </div>
                </div>

                {/* Missing Keywords */}
                {result.missingKeywords.length > 0 && (
                  <div className="missing-keywords-section">
                    <h3>Missing Keywords ({result.missingKeywords.length})</h3>
                    <p className="section-description">Add these keywords from the job description to your CV where relevant:</p>
                    <div className="keyword-tags">
                      {result.missingKeywords.map((kw, i) => <span key={i} className="keyword-tag missing-tag">{kw}</span>)}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                <div className="suggestions-container">
                  <h3 className="suggestions-title">AI Optimisation Suggestions</h3>
                  <div className="suggestions-list-optimized">
                    {result.suggestions.map((s, i) => (
                      <div key={i} className={`suggestion-card priority-${s.priority}`}>
                        <div className="suggestion-header">
                          <div className="suggestion-meta">
                            <span className={`priority-badge priority-${s.priority}`}>
                              {s.priority === "high" ? "High Priority" : s.priority === "medium" ? "Medium Priority" : "Low Priority"}
                            </span>
                            <span className="section-badge">{s.section}</span>
                            <span className={`type-badge type-${s.type}`}>
                              {s.type === "add" ? "Add" : s.type === "improve" ? "Improve" : s.type === "remove" ? "Remove" : "Reorder"}
                            </span>
                          </div>
                        </div>
                        <div className="suggestion-content">
                          <p className="suggestion-text">{s.suggested}</p>
                          <p className="suggestion-reason"><strong>Why:</strong> {s.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
