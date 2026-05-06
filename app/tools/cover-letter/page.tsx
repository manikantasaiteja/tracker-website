"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";

export default function CoverLetterPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createBrowserSupabaseClient();
  });

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"cv" | "job">("cv");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState<string>("");
  const [userInfo, setUserInfo] = useState({ fullName: "", email: "", phone: "" });
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
        .select("*")
        .eq("id", session.user.id)
        .single();

      const fullName = profileData?.full_name || session.user.user_metadata.full_name || "";
      const email = session.user.email || "";
      const phone = profileData?.phone_number || "";

      setUserLabel(fullName || email || "Trackr user");
      setUserInfo({ fullName, email, phone });
      setLoading(false);
    }

    checkAuth();
  }, [supabase, router]);

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function extractTextFromPDF(file: File): Promise<string> {
    try {
      // Dynamically import pdfjs-dist only on client side
      const pdfjsLib = await import("pdfjs-dist");
      
      // Configure worker - use unpkg as a reliable CDN that auto-resolves versions
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: false,
      }).promise;
      
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => {
            // Handle both string items and objects with 'str' property
            if (typeof item === 'string') return item;
            return item.str || '';
          })
          .join(" ");
        fullText += pageText + "\n";
      }

      if (!fullText.trim()) {
        throw new Error("No text could be extracted from the PDF. The PDF might be image-based or empty.");
      }

      return fullText.trim();
    } catch (err) {
      console.error("PDF extraction error:", err);
      if (err instanceof Error && err.message.includes("No text could be extracted")) {
        throw err;
      }
      throw new Error("Failed to extract text from PDF. Please ensure it's a valid PDF file.");
    }
  }

  async function handleCVUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("File selected:", file.name, file.type);

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB.");
      return;
    }

    setCvFile(file);
    setError(null);
    setExtracting(true);

    try {
      const text = await extractTextFromPDF(file);
      console.log("Extracted text length:", text.length);
      setCvText(text);
      setError(null);
    } catch (err) {
      console.error("PDF extraction error:", err);
      setError(err instanceof Error ? err.message : "Failed to extract text from PDF.");
      setCvFile(null);
      setCvText("");
    } finally {
      setExtracting(false);
    }
  }

  function generateCoverLetter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    if (!cvText.trim() || !jobDescription.trim()) {
      setError("Please upload your CV and provide the job description.");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Extract company name and position from job description (simple extraction)
      const companyMatch = jobDescription.match(/(?:company|organization|employer):\s*([^\n]+)/i);
      const positionMatch = jobDescription.match(/(?:position|role|title|job):\s*([^\n]+)/i);
      
      const companyName = companyMatch ? companyMatch[1].trim() : "the company";
      const position = positionMatch ? positionMatch[1].trim() : "this position";

      // Extract key skills from CV (simple keyword extraction)
      const skillKeywords = ["experience", "skilled", "proficient", "expertise", "knowledge"];
      const cvLower = cvText.toLowerCase();
      const hasRelevantSkills = skillKeywords.some(keyword => cvLower.includes(keyword));

      const letter = `${userInfo.fullName}
${userInfo.email}
${userInfo.phone}

${today}

Hiring Manager
${companyName}

Dear Hiring Manager,

I am writing to express my strong interest in ${position} at ${companyName}. After reviewing the job description and considering my background, I am confident that my skills and experience make me an excellent candidate for this role.

Based on my CV, I bring relevant experience and qualifications that align well with your requirements. My professional background demonstrates a strong foundation in the key areas mentioned in your job posting, and I am excited about the opportunity to contribute to your team.

The role at ${companyName} particularly appeals to me because it offers the chance to apply my skills in a meaningful way while continuing to grow professionally. I am impressed by your organization's mission and values, and I believe my background would enable me to make valuable contributions from day one.

I am enthusiastic about the possibility of joining ${companyName} and would welcome the opportunity to discuss how my experience and qualifications align with your needs. Thank you for considering my application.

I look forward to the opportunity to speak with you about this position.

Sincerely,
${userInfo.fullName}`;

      setGeneratedCoverLetter(letter);
    } catch (err) {
      setError("Failed to generate cover letter. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function copyCoverLetter() {
    navigator.clipboard.writeText(generatedCoverLetter);
    alert("Cover letter copied to clipboard!");
  }

  function downloadCoverLetter() {
    const blob = new Blob([generatedCoverLetter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Cover_Letter_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading || !supabase) {
    return (
      <main className="route-loader">
        <div className="route-loader__pulse" />
        <p>Loading Cover Letter Generator...</p>
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
        <div className="tools-layout">
          <section className="tool-card">
            <div className="tool-header">
              <div className="tool-icon">✉️</div>
              <div>
                <h2 className="tool-title">AI Cover Letter Generator</h2>
                <p className="tool-description">
                  Upload your CV and paste the job description. Our AI will generate a tailored cover letter that highlights your relevant experience and skills.
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-navigation">
              <button
                className={`tab-nav-button ${activeTab === "cv" ? "active" : ""}`}
                onClick={() => setActiveTab("cv")}
                type="button"
              >
                <span className="tab-icon">📄</span>
                <span className="tab-label">Step 1: Upload CV</span>
              </button>
              <button
                className={`tab-nav-button ${activeTab === "job" ? "active" : ""}`}
                onClick={() => setActiveTab("job")}
                type="button"
                disabled={!cvText}
              >
                <span className="tab-icon">💼</span>
                <span className="tab-label">Step 2: Job Description</span>
              </button>
            </div>

            <form className="cover-letter-form" onSubmit={generateCoverLetter}>
              {/* CV Upload Tab */}
              {activeTab === "cv" && (
                <div className="tab-content">
                  <div className="tab-content-header">
                    <h3>📄 Upload Your CV</h3>
                    <p>Upload your CV in PDF format. We'll extract the text to create your cover letter.</p>
                  </div>

                  <div className="ats-input-group">
                    <div className="ats-label">
                      <span className="label-text">
                        <strong className="required-field">Upload Your CV (PDF)</strong>
                        <span className="label-hint">Upload your current CV for analysis</span>
                      </span>
                      <div className="file-upload-zone">
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleCVUpload}
                          style={{ display: 'none' }}
                          id="cv-upload-cover-letter"
                        />
                        <label 
                          htmlFor="cv-upload-cover-letter" 
                          className="file-upload-label"
                          style={{ cursor: 'pointer' }}
                        >
                          {extracting ? (
                            <>
                              <span className="upload-icon">⏳</span>
                              <span className="upload-text">Extracting text from PDF...</span>
                            </>
                          ) : cvFile ? (
                            <>
                              <span className="upload-icon">✅</span>
                              <span className="upload-text">
                                <strong>{cvFile.name}</strong>
                                <span className="file-size">
                                  {(cvFile.size / 1024).toFixed(1)} KB • {cvText.length} characters extracted
                                </span>
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="upload-icon">📄</span>
                              <span className="upload-text">
                                <strong>Click to upload your CV</strong>
                                <span className="file-hint">PDF format only • Max 10MB</span>
                              </span>
                            </>
                          )}
                        </label>
                      </div>
                      {cvText && (
                        <details className="cv-preview">
                          <summary>👁️ Preview extracted text ({cvText.length} characters)</summary>
                          <div className="preview-content">
                            {cvText.substring(0, 500)}...
                          </div>
                        </details>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="auth-banner auth-banner--error">{error}</div>
                  )}

                  {cvText && (
                    <div className="tab-action">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => setActiveTab("job")}
                      >
                        Next: Add Job Description →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Job Description Tab */}
              {activeTab === "job" && (
                <div className="tab-content">
                  <div className="tab-content-header">
                    <h3>💼 Job Description</h3>
                    <p>Paste the complete job posting. Include requirements, responsibilities, and company information.</p>
                  </div>

                  <div className="ats-input-group">
                    <div className="ats-label">
                      <span className="label-text">
                        <strong className="required-field">Job Description</strong>
                        <span className="label-hint">Paste the full job posting you're applying for</span>
                      </span>
                      <textarea
                        className="ats-textarea"
                        onChange={(event) => setJobDescription(event.target.value)}
                        placeholder="Paste the full job description here... Include company name, position title, requirements, responsibilities, qualifications, and any other details from the job posting."
                        required
                        rows={16}
                        value={jobDescription}
                      />
                      <span className="char-count">{jobDescription.length} characters</span>
                    </div>
                  </div>

                  {error && (
                    <div className="auth-banner auth-banner--error">{error}</div>
                  )}

                  <div className="tab-action-group">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setActiveTab("cv")}
                    >
                      ← Back to CV
                    </button>
                    <button
                      className="primary-button analyze-button"
                      disabled={generating || extracting || !cvText || !jobDescription}
                      type="submit"
                    >
                      {generating ? "🔄 Generating..." : "✨ Generate Cover Letter"}
                    </button>
                  </div>
                </div>
              )}
            </form>

            {generatedCoverLetter && (
              <div className="cover-letter-result">
                <div className="result-header">
                  <h3>📄 Your Cover Letter</h3>
                  <div className="result-actions">
                    <button
                      className="secondary-button"
                      onClick={copyCoverLetter}
                      type="button"
                    >
                      📋 Copy
                    </button>
                    <button
                      className="secondary-button"
                      onClick={downloadCoverLetter}
                      type="button"
                    >
                      💾 Download
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
