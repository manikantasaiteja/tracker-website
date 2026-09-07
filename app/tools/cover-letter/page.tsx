"use client";

import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";

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

export default function CoverLetterPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() =>
    typeof window !== "undefined" ? createBrowserSupabaseClient() : null
  );

  // Apply saved theme on mount
  useEffect(() => {
    const saved = window.localStorage.getItem("trackr-theme");
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
  }, []);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState<"cv" | "job">("cv");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [userInfo, setUserInfo] = useState({ fullName: "", email: "", phone: "" });
  const [userLabel, setUserLabel] = useState("Guest");

  useEffect(() => {
    if (!supabase) return;
    async function checkAuth() {
      const { data: { session }, error: sessionError } = await supabase!.auth.getSession();
      if (sessionError || !session?.user) { router.replace("/login"); return; }
      const { data: profileData } = await supabase!.from("user_profiles").select("*").eq("id", session.user.id).single();
      const fullName = profileData?.full_name || session.user.user_metadata.full_name || "";
      setUserLabel(fullName || session.user.email || "Trackr user");
      setUserInfo({ fullName, email: session.user.email || "", phone: profileData?.phone_number || "" });
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

  async function generateCoverLetter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cvText.trim() || !jobDescription.trim()) {
      setError("Please upload your CV and provide the job description."); return;
    }
    setGenerating(true); setError(null); setGeneratedCoverLetter("");
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tool: "cover-letter", cvText, jobDescription, userInfo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI generation failed");
      setGeneratedCoverLetter(data.coverLetter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed. Please try again.");
    } finally { setGenerating(false); }
  }

  function copyCoverLetter() {
    navigator.clipboard.writeText(generatedCoverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadTxt() {
    const blob = new Blob([generatedCoverLetter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cover_Letter_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const pageW = doc.internal.pageSize.getWidth();   // 210
    const pageH = doc.internal.pageSize.getHeight();  // 297
    const marginL = 20;
    const marginR = 20;
    const contentW = pageW - marginL - marginR;       // 170
    const lineH = 5.5;
    let y = 15;

    // ── Helper: write wrapped text, returns new y ──────────────
    function writeText(
      text: string,
      x: number,
      opts: { bold?: boolean; size?: number; align?: "left" | "right" | "center" } = {}
    ): void {
      const { bold = false, size = 10.5, align = "left" } = opts;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const maxW = align === "right" ? contentW : contentW - (x - marginL);
      const wrapped = doc.splitTextToSize(text, maxW);
      for (const line of wrapped) {
        if (y + lineH > pageH - 12) { doc.addPage(); y = 15; }
        doc.text(line, x, y, { align });
        y += lineH;
      }
    }

    function gap(mm = 4) { y += mm; }

    // ── Parse the letter into structured parts ─────────────────
    const rawLines = generatedCoverLetter.split("\n").map(l => l.trim()).filter((l, i, arr) => {
      // remove blank leading lines
      if (i === 0 && !l) return false;
      return true;
    });

    // Collect sections by scanning through lines
    const senderLines: string[] = [];
    const recipientLines: string[] = [];
    let dateStr = "";
    let subjectLine = "";
    let salutation = "";
    const bodyParagraphs: string[] = [];
    let signOff = "";
    let signerName = "";

    type Phase = "sender" | "recipient" | "body" | "signoff";
    let phase: Phase = "sender";
    let bodyBuffer = "";
    const fullName = userInfo.fullName || "";

    for (const line of rawLines) {
      if (!line) {
        if (phase === "body" && bodyBuffer.trim()) {
          bodyParagraphs.push(bodyBuffer.trim());
          bodyBuffer = "";
        }
        continue;
      }

      // Skip if line is just the user's full name repeated (header already shows it)
      if (line === fullName && senderLines.length === 0 && phase === "sender") continue;

      // Date detection
      if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(line) && line.length < 70) {
        dateStr = line;
        if (phase === "sender") phase = "recipient";
        continue;
      }

      // Subject line
      if (/^(subject|re:|betreff)[\s:]/i.test(line)) {
        subjectLine = line;
        phase = "body";
        continue;
      }

      // Salutation
      if (/^dear\b/i.test(line)) {
        salutation = line;
        phase = "body";
        continue;
      }

      // Sign-off
      if (/^(kind regards|yours sincerely|yours faithfully|best regards|sincerely,|mit freundlichen)/i.test(line)) {
        if (phase === "body" && bodyBuffer.trim()) {
          bodyParagraphs.push(bodyBuffer.trim());
          bodyBuffer = "";
        }
        signOff = line;
        phase = "signoff";
        continue;
      }
      if (phase === "signoff") {
        signerName = line;
        continue;
      }

      // Recipient block starts with known keywords or after sender
      if (phase === "sender" && senderLines.length >= 4 &&
        /^(hiring|to whom|hr |human resources|dear|the |fraunhofer|company|bloom|campus|berlin|munich|hamburg|london|new york)/i.test(line)) {
        phase = "recipient";
      }

      if (phase === "sender") {
        senderLines.push(line);
      } else if (phase === "recipient") {
        recipientLines.push(line);
      } else if (phase === "body") {
        bodyBuffer += (bodyBuffer ? " " : "") + line;
      }
    }
    if (bodyBuffer.trim()) bodyParagraphs.push(bodyBuffer.trim());

    // ── 1. Name header bold right-aligned ─────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(fullName, pageW - marginR, y, { align: "right" });
    y += 6;

    // Horizontal rule
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.35);
    doc.line(marginL, y, pageW - marginR, y);
    y += 5;

    // ── 2. Sender address right-aligned ───────────────────────
    for (const sl of senderLines) {
      writeText(sl, pageW - marginR, { align: "right", size: 10 });
    }
    gap(4);

    // ── 3. Recipient left + Date right (same row area) ─────────
    const recipientStartY = y;
    for (const rl of recipientLines) {
      const isBoldLine = /^(hiring|to whom|hr |the |fraunhofer|bloom|campus)/i.test(rl);
      writeText(rl, marginL, { bold: isBoldLine, size: 10 });
    }
    // Place date at vertical midpoint of recipient block
    if (dateStr) {
      const midY = recipientStartY + (y - recipientStartY) / 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(dateStr, pageW - marginR, midY, { align: "right" });
    }
    gap(5);

    // ── 4. Subject line ────────────────────────────────────────
    if (subjectLine) {
      const colon = subjectLine.indexOf(":");
      if (colon !== -1) {
        const prefix = subjectLine.slice(0, colon + 1);
        const rest = subjectLine.slice(colon + 1).trim();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        const pw = doc.getTextWidth(prefix + " ");
        if (y + lineH > pageH - 12) { doc.addPage(); y = 15; }
        doc.text(prefix, marginL, y);
        doc.setFont("helvetica", "normal");
        const restWrapped = doc.splitTextToSize(rest, contentW - pw);
        doc.text(restWrapped[0] ?? "", marginL + pw, y);
        y += lineH;
        for (let i = 1; i < restWrapped.length; i++) {
          if (y + lineH > pageH - 12) { doc.addPage(); y = 15; }
          doc.text(restWrapped[i], marginL + pw, y);
          y += lineH;
        }
      } else {
        writeText(subjectLine, marginL, { bold: true });
      }
      gap(2);
    }

    // ── 5. Salutation ──────────────────────────────────────────
    if (salutation) {
      writeText(salutation, marginL, { size: 10.5 });
      gap(3);
    }

    // ── 6. Body paragraphs — plain left-aligned (no justify) ───
    for (const para of bodyParagraphs) {
      writeText(para, marginL, { size: 10.5 });
      gap(3);
    }

    // ── 7. Sign-off ────────────────────────────────────────────
    if (signOff) {
      writeText(signOff, marginL, { size: 10.5 });
      writeText(signerName || fullName, marginL, { size: 10.5 });
    }

    doc.save(`Cover_Letter_${new Date().toISOString().split("T")[0]}.pdf`);
  }

  if (loading || !supabase) {
    return <main className="route-loader"><div className="route-loader__pulse" /><p>Loading Cover Letter Generator...</p></main>;
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
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </div>
              <div>
                <h2 className="tool-title">AI Cover Letter Generator</h2>
                <p className="tool-description">Upload your CV and paste the job description to generate a personalised cover letter.</p>
              </div>
            </div>

            {/* Step tabs */}
            <div className="tab-navigation">
              <button className={`tab-nav-button ${activeTab === "cv" ? "active" : ""}`}
                onClick={() => setActiveTab("cv")} type="button">
                <span className="tab-label">Step 1: Upload CV</span>
              </button>
              <button className={`tab-nav-button ${activeTab === "job" ? "active" : ""}`}
                onClick={() => setActiveTab("job")} type="button" disabled={!cvText}>
                <span className="tab-label">Step 2: Job Description</span>
              </button>
            </div>

            <form className="cover-letter-form" onSubmit={generateCoverLetter}>
              {/* CV Upload Tab */}
              {activeTab === "cv" && (
                <div className="tab-content">
                  <div className="tab-content-header">
                    <h3>Upload Your CV</h3>
                    <p>Upload your CV in PDF format. AI will use your real experience to write the letter.</p>
                  </div>
                  <div className="ats-input-group">
                    <div className="ats-label">
                      <span className="label-text">
                        <strong className="required-field">CV (PDF)</strong>
                        <span className="label-hint">PDF only · Max 10MB</span>
                      </span>
                      <div className="file-upload-zone">
                        <input type="file" accept=".pdf,application/pdf" onChange={handleCVUpload}
                          style={{ display: "none" }} id="cv-upload-cover-letter" />
                        <label htmlFor="cv-upload-cover-letter" className="file-upload-label" style={{ cursor: "pointer" }}>
                          {extracting
                            ? <><span className="upload-icon">⏳</span><span className="upload-text">Extracting text...</span></>
                            : cvFile
                            ? <><span className="upload-icon">✅</span><span className="upload-text"><strong>{cvFile.name}</strong><span className="file-size">{cvText.length} chars extracted</span></span></>
                            : <><span className="upload-icon">📄</span><span className="upload-text"><strong>Click to upload your CV</strong><span className="file-hint">PDF format only</span></span></>}
                        </label>
                      </div>
                    </div>
                  </div>
                  {error && <div className="auth-banner auth-banner--error">{error}</div>}
                  {cvText && (
                    <div className="tab-action">
                      <button type="button" className="primary-button" onClick={() => setActiveTab("job")}>
                        Next: Add Job Description
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Job Description Tab */}
              {activeTab === "job" && (
                <div className="tab-content">
                  <div className="tab-content-header">
                    <h3>Job Description</h3>
                    <p>Paste the full job posting. AI uses it to personalise every sentence of your cover letter.</p>
                  </div>
                  <div className="ats-input-group">
                    <div className="ats-label">
                      <span className="label-text">
                        <strong className="required-field">Job Description</strong>
                        <span className="label-hint">Include company name, role, and requirements</span>
                      </span>
                      <textarea className="ats-textarea" value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the full job description here..." required rows={14} />
                      <span className="char-count">{jobDescription.length} characters</span>
                    </div>
                  </div>
                  {error && <div className="auth-banner auth-banner--error">{error}</div>}
                  <div className="tab-action-group">
                    <button type="button" className="secondary-button" onClick={() => setActiveTab("cv")}>
                      Back to CV
                    </button>
                    <button className="primary-button analyze-button" type="submit"
                      disabled={generating || extracting || !cvText || !jobDescription}>
                      {generating ? "Generating with AI..." : "Generate Cover Letter"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </section>

          {/* ── RIGHT: Results panel ── */}
          <section className="tool-panel tool-panel--results">
            {!generatedCoverLetter && !generating && (
              <div className="results-empty">
                <div className="results-empty-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <h3>Your cover letter will appear here</h3>
                <p>Upload your CV and paste the job description, then click Generate to create your personalised cover letter.</p>
              </div>
            )}

            {generating && (
              <div className="results-loading">
                <div className="route-loader__pulse" />
                <p>Writing your personalised cover letter...</p>
              </div>
            )}

            {generatedCoverLetter && (
              <div className="cover-letter-result">
                <div className="result-header">
                  <h3>Your AI-Generated Cover Letter</h3>
                  <div className="result-actions">
                    <button className="secondary-button" onClick={copyCoverLetter} type="button">
                      {copied ? "✓ Copied!" : "Copy"}
                    </button>
                    <button className="secondary-button" onClick={downloadTxt} type="button">
                      ↓ TXT
                    </button>
                    <button className="primary-button" onClick={downloadPdf} type="button">
                      ↓ PDF
                    </button>
                  </div>
                </div>
                <div className="cover-letter-preview">
                  <pre>{generatedCoverLetter}</pre>
                </div>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
