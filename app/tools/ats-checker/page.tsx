"use client";

import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";

type ATSResult = {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
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

export default function ATSCheckerPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() =>
    typeof window !== "undefined" ? createBrowserSupabaseClient() : null
  );

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState("");
  const [manualCvText, setManualCvText] = useState("");
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<ATSResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState("Guest");

  // Apply saved theme on mount
  useEffect(() => {
    const saved = window.localStorage.getItem("trackr-theme");
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
  }, []);

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

  async function analyzeATS(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finalCvText = inputMode === "pdf" ? cvText : manualCvText;
    if (!finalCvText.trim() || !jobDescription.trim()) {
      setError("Please provide your CV and the job description."); return;
    }
    setAnalyzing(true); setError(null); setResult(null);
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tool: "ats", cvText: finalCvText, jobDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI analysis failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally { setAnalyzing(false); }
  }

  if (loading || !supabase) {
    return <main className="route-loader"><div className="route-loader__pulse" /><p>Loading ATS Checker...</p></main>;
  }

  return (
    <div className="dashboard-shell">
      <DashboardHeader userLabel={userLabel} onSignOut={handleSignOut} />
      <main className="dashboard-main">
        <div className="tool-split-layout">

          {/* ── LEFT: Input panel ── */}
          <section className="tool-panel tool-panel--input">
            <div className="tool-header">
              <div className="tool-icon-svg">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
              <div>
                <h2 className="tool-title">ATS Score Checker</h2>
                <p className="tool-description">Upload your CV and paste the job description to get your ATS score and keyword analysis.</p>
              </div>
            </div>

            <form className="ats-form" onSubmit={analyzeATS}>
              <div className="input-mode-selector">
                <label className="mode-option">
                  <input type="radio" name="inputMode" value="pdf" checked={inputMode === "pdf"}
                    onChange={() => { setInputMode("pdf"); setManualCvText(""); setError(null); }} />
                  <span>Upload PDF</span>
                </label>
                <label className="mode-option">
                  <input type="radio" name="inputMode" value="text" checked={inputMode === "text"}
                    onChange={() => { setInputMode("text"); setCvFile(null); setCvText(""); setError(null); }} />
                  <span>Paste Text</span>
                </label>
              </div>

              <div className="ats-input-group">
                {inputMode === "pdf" ? (
                  <label className="ats-label">
                    <span className="label-text">
                      <strong className="required-field">Upload Your CV (PDF)</strong>
                      <span className="label-hint">PDF only · Max 10MB</span>
                    </span>
                    <div className="file-upload-zone">
                      <input type="file" accept=".pdf" onChange={handleCVUpload} className="file-input-hidden" id="cv-upload-ats" />
                      <label htmlFor="cv-upload-ats" className="file-upload-label">
                        {extracting ? <><span className="upload-icon">⏳</span><span className="upload-text">Extracting text...</span></>
                          : cvFile ? <><span className="upload-icon">✅</span><span className="upload-text"><strong>{cvFile.name}</strong><span className="file-size">{cvText.length} chars extracted</span></span></>
                          : <><span className="upload-icon">📄</span><span className="upload-text"><strong>Click to upload your CV</strong><span className="file-hint">PDF format only</span></span></>}
                      </label>
                    </div>
                  </label>
                ) : (
                  <label className="ats-label">
                    <span className="label-text">
                      <strong className="required-field">Paste Your CV</strong>
                    </span>
                    <textarea className="ats-textarea" value={manualCvText} onChange={(e) => setManualCvText(e.target.value)}
                      placeholder="Paste your CV text here..." rows={8} required={inputMode === "text"} />
                    <span className="char-count">{manualCvText.length} characters</span>
                  </label>
                )}

                <label className="ats-label">
                  <span className="label-text">
                    <strong className="required-field">Job Description</strong>
                    <span className="label-hint">Paste the full job posting</span>
                  </span>
                  <textarea className="ats-textarea" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the full job description here..." rows={8} required />
                  <span className="char-count">{jobDescription.length} characters</span>
                </label>
              </div>

              {error && <div className="auth-banner auth-banner--error">{error}</div>}

              <button className="primary-button analyze-button" type="submit"
                disabled={analyzing || extracting || (inputMode === "pdf" ? !cvText : !manualCvText) || !jobDescription}>
                {analyzing ? "Analysing with AI..." : "Analyse ATS Score"}
              </button>
            </form>
          </section>

          {/* ── RIGHT: Results panel ── */}
          <section className="tool-panel tool-panel--results">
            {!result && !analyzing && (
              <div className="results-empty">
                <div className="results-empty-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <h3>Your ATS analysis will appear here</h3>
                <p>Upload your CV and paste a job description, then click Analyse to see your score, matched keywords, and AI suggestions.</p>
              </div>
            )}

            {analyzing && (
              <div className="results-loading">
                <div className="route-loader__pulse" />
                <p>Analysing your CV against the job description...</p>
              </div>
            )}

            {result && (
              <div className="ats-results">
                {/* Score */}
                <div className="score-section">
                  <div className="score-circle">
                    <svg viewBox="0 0 100 100" className="score-svg">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border-strong)" strokeWidth="8" />
                      <circle cx="50" cy="50" r="45" fill="none"
                        stroke={result.score >= 75 ? "var(--success)" : result.score >= 60 ? "#ffc454" : "var(--danger)"}
                        strokeWidth="8" strokeDasharray={`${result.score * 2.827} 283`}
                        strokeLinecap="round" transform="rotate(-90 50 50)" />
                    </svg>
                    <div className="score-text">
                      <span className="score-number">{result.score}</span>
                      <span className="score-label">ATS Score</span>
                    </div>
                  </div>
                  <div className="score-interpretation">
                    <h3>{result.score >= 75 ? "Excellent Match" : result.score >= 60 ? "Good Match" : "Needs Improvement"}</h3>
                    <p className="ai-summary">{result.summary}</p>
                  </div>
                </div>

                {/* Keywords */}
                <div className="keywords-section">
                  <div className="keyword-box matched">
                    <h3>Matched Keywords ({result.matchedKeywords.length})</h3>
                    <div className="keyword-tags">
                      {result.matchedKeywords.map((kw, i) => <span key={i} className="keyword-tag matched-tag">{kw}</span>)}
                    </div>
                  </div>
                  <div className="keyword-box missing">
                    <h3>Missing Keywords ({result.missingKeywords.length})</h3>
                    <div className="keyword-tags">
                      {result.missingKeywords.map((kw, i) => <span key={i} className="keyword-tag missing-tag">{kw}</span>)}
                    </div>
                  </div>
                </div>

                {/* Suggestions */}
                <div className="suggestions-section">
                  <h3>AI Suggestions</h3>
                  <ul className="suggestions-list">
                    {result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
