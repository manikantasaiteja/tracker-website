"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Suggestion = {
  section: string;
  type: "add" | "improve" | "remove" | "reorder";
  priority: "high" | "medium" | "low";
  original?: string;
  suggested: string;
  reason: string;
};

type AnalysisResult = {
  suggestions: Suggestion[];
  missingKeywords: string[];
  matchScore: number;
  optimizedResume: string;
};

export default function ResumeBuilderPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createBrowserSupabaseClient();
  });

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function extractTextFromPDF(file: File): Promise<string> {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += pageText + "\n";
      }

      return fullText;
    } catch (err) {
      throw new Error("Failed to extract text from PDF. Please ensure it's a valid PDF file.");
    }
  }

  async function handleCVUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }

    setCvFile(file);
    setError(null);
    setExtracting(true);

    try {
      const text = await extractTextFromPDF(file);
      setCvText(text);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract text from PDF.");
      setCvFile(null);
      setCvText("");
    } finally {
      setExtracting(false);
    }
  }

  function extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
      "be", "have", "has", "had", "do", "does", "did", "will", "would", "should",
      "could", "may", "might", "must", "can", "this", "that", "these", "those",
      "i", "you", "he", "she", "it", "we", "they", "what", "which", "who",
      "when", "where", "why", "how", "all", "each", "every", "both", "few",
      "more", "most", "other", "some", "such", "no", "nor", "not", "only",
      "own", "same", "so", "than", "too", "very", "just", "about", "into",
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s\-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    const wordCount = new Map<string, number>();
    words.forEach((word) => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Extract multi-word phrases
    const phrases: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (bigram.length > 6) phrases.push(bigram);
    }

    phrases.forEach((phrase) => {
      wordCount.set(phrase, (wordCount.get(phrase) || 0) + 1);
    });

    return Array.from(wordCount.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word]) => word);
  }

  function analyzeResume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!cvText.trim() || !jobDescription.trim()) {
      setError("Please upload your CV and provide the job description.");
      return;
    }

    setAnalyzing(true);

    try {
      const jobKeywords = extractKeywords(jobDescription);
      const cvKeywords = extractKeywords(cvText);
      const cvTextLower = cvText.toLowerCase();
      const jobDescLower = jobDescription.toLowerCase();

      // Find missing keywords
      const missingKeywords = jobKeywords.filter(
        (keyword) => !cvTextLower.includes(keyword)
      );

      // Calculate match score
      const matchedCount = jobKeywords.filter((keyword) =>
        cvTextLower.includes(keyword)
      ).length;
      const matchScore = jobKeywords.length > 0
        ? Math.round((matchedCount / jobKeywords.length) * 100)
        : 0;

      // Generate suggestions
      const suggestions: Suggestion[] = [];

      // 1. Skills section suggestions
      const skillKeywords = ["skill", "proficient", "experience with", "knowledge of"];
      const hasSkillsSection = skillKeywords.some(kw => jobDescLower.includes(kw));
      
      if (hasSkillsSection && missingKeywords.length > 0) {
        const topMissingSkills = missingKeywords.slice(0, 8).join(", ");
        suggestions.push({
          section: "Skills",
          type: "add",
          priority: "high",
          suggested: `Add these relevant skills to your resume: ${topMissingSkills}`,
          reason: "These keywords appear in the job description but are missing from your CV. Adding them will improve your ATS score.",
        });
      }

      // 2. Professional summary suggestions
      if (!cvText.toLowerCase().includes("summary") && !cvText.toLowerCase().includes("objective")) {
        const topJobKeywords = jobKeywords.slice(0, 5).join(", ");
        suggestions.push({
          section: "Professional Summary",
          type: "add",
          priority: "high",
          suggested: `Add a professional summary at the top of your resume that incorporates key terms like: ${topJobKeywords}`,
          reason: "A targeted professional summary helps ATS systems quickly identify your relevance to the role.",
        });
      }

      // 3. Action verbs and quantification
      const actionVerbs = ["achieved", "improved", "increased", "decreased", "led", "managed", "developed", "created"];
      const hasActionVerbs = actionVerbs.some(verb => cvTextLower.includes(verb));
      
      if (!hasActionVerbs) {
        suggestions.push({
          section: "Experience",
          type: "improve",
          priority: "medium",
          suggested: "Start your bullet points with strong action verbs (e.g., Achieved, Improved, Led, Developed, Managed)",
          reason: "Action verbs make your accomplishments more impactful and are favored by ATS systems.",
        });
      }

      // 4. Quantification suggestions
      const hasNumbers = /\d+%|\d+\+|\$\d+/.test(cvText);
      if (!hasNumbers) {
        suggestions.push({
          section: "Experience",
          type: "improve",
          priority: "high",
          suggested: "Quantify your achievements with specific numbers, percentages, or metrics (e.g., 'Increased sales by 30%', 'Managed team of 10', 'Reduced costs by $50K')",
          reason: "Quantified achievements are more credible and help you stand out to both ATS and human reviewers.",
        });
      }

      // 5. Job title alignment
      const jobTitleMatch = jobDescription.match(/(?:position|role|title):\s*([^\n]+)/i);
      if (jobTitleMatch) {
        const targetJobTitle = jobTitleMatch[1].trim();
        if (!cvTextLower.includes(targetJobTitle.toLowerCase())) {
          suggestions.push({
            section: "Experience",
            type: "improve",
            priority: "medium",
            suggested: `Consider highlighting experience related to "${targetJobTitle}" or using similar terminology in your job titles`,
            reason: "Aligning your job titles with the target role helps ATS systems recognize your relevance.",
          });
        }
      }

      // 6. Education and certifications
      if (jobDescLower.includes("degree") || jobDescLower.includes("bachelor") || jobDescLower.includes("master")) {
        if (!cvTextLower.includes("education") && !cvTextLower.includes("degree")) {
          suggestions.push({
            section: "Education",
            type: "add",
            priority: "high",
            suggested: "Ensure your education section is clearly labeled and includes your degree, institution, and graduation date",
            reason: "Many ATS systems specifically look for education credentials.",
          });
        }
      }

      // 7. Certification suggestions
      if (jobDescLower.includes("certification") || jobDescLower.includes("certified")) {
        if (!cvTextLower.includes("certification") && !cvTextLower.includes("certified")) {
          suggestions.push({
            section: "Certifications",
            type: "add",
            priority: "medium",
            suggested: "Add a certifications section if you have relevant professional certifications",
            reason: "The job description mentions certifications, which could be a key requirement.",
          });
        }
      }

      // 8. Formatting suggestions
      suggestions.push({
        section: "Formatting",
        type: "improve",
        priority: "low",
        suggested: "Use standard section headings: Professional Summary, Skills, Experience, Education, Certifications",
        reason: "Standard headings help ATS systems correctly parse your resume sections.",
      });

      // 9. Keyword density
      if (matchScore < 60) {
        suggestions.push({
          section: "Overall",
          type: "improve",
          priority: "high",
          suggested: "Your CV has low keyword match with the job description. Review the job requirements carefully and incorporate relevant terms naturally throughout your resume.",
          reason: `Your current match score is ${matchScore}%. Aim for at least 70% to improve your chances of passing ATS filters.`,
        });
      }

      // 10. Acronyms and full terms
      suggestions.push({
        section: "Overall",
        type: "improve",
        priority: "low",
        suggested: "Include both acronyms and full terms (e.g., 'Artificial Intelligence (AI)', 'Customer Relationship Management (CRM)')",
        reason: "Some ATS systems search for acronyms while others search for full terms.",
      });

      // Generate optimized resume with suggestions applied
      let optimizedResume = cvText;
      
      // Add a note at the top
      optimizedResume = `[OPTIMIZED FOR: ${jobTitleMatch ? jobTitleMatch[1].trim() : "Target Position"}]\n\n` + optimizedResume;
      
      // Add missing keywords suggestion at the end
      if (missingKeywords.length > 0) {
        optimizedResume += `\n\n[SUGGESTED KEYWORDS TO INCORPORATE: ${missingKeywords.slice(0, 15).join(", ")}]`;
      }

      setResult({
        suggestions: suggestions.sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }),
        missingKeywords: missingKeywords.slice(0, 20),
        matchScore,
        optimizedResume,
      });
    } catch (err) {
      setError("Failed to analyze. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  function copyOptimizedResume() {
    if (!result) return;
    navigator.clipboard.writeText(result.optimizedResume);
    alert("Optimized resume copied to clipboard!");
  }

  function downloadOptimizedResume() {
    if (!result) return;
    const blob = new Blob([result.optimizedResume], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Optimized_Resume_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading || !supabase) {
    return (
      <main className="route-loader">
        <div className="route-loader__pulse" />
        <p>Loading Resume Builder...</p>
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
        <div className="resume-builder-layout">
          <section className="tool-card">
            <div className="tool-header">
              <div className="tool-icon">🎯</div>
              <div>
                <h2 className="tool-title">AI Resume Optimizer</h2>
                <p className="tool-description">
                  Upload your CV and paste the job description. Get intelligent suggestions to tailor your resume for the specific role, improve ATS compatibility, and increase your chances of landing an interview.
                </p>
              </div>
            </div>

            <form className="ats-form" onSubmit={analyzeResume}>
              <div className="ats-input-group">
                <label className="ats-label">
                  <span className="label-text">
                    <strong className="required-field">Upload Your CV (PDF)</strong>
                    <span className="label-hint">Upload your current CV for analysis and optimization</span>
                  </span>
                  <div className="file-upload-zone">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleCVUpload}
                      className="file-input-hidden"
                      id="cv-upload-optimizer"
                      required={!cvText}
                    />
                    <label htmlFor="cv-upload-optimizer" className="file-upload-label">
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
                </label>

                <label className="ats-label">
                  <span className="label-text">
                    <strong className="required-field">Job Description</strong>
                    <span className="label-hint">Paste the complete job posting you're applying for</span>
                  </span>
                  <textarea
                    className="ats-textarea"
                    onChange={(event) => setJobDescription(event.target.value)}
                    placeholder="Paste the full job description here... Include requirements, responsibilities, qualifications, and any other details from the job posting."
                    required
                    rows={12}
                    value={jobDescription}
                  />
                  <span className="char-count">{jobDescription.length} characters</span>
                </label>
              </div>

              {error ? (
                <div className="auth-banner auth-banner--error">{error}</div>
              ) : null}

              <button
                className="primary-button analyze-button"
                disabled={analyzing || extracting || !cvText}
                type="submit"
              >
                {analyzing ? "🔄 Analyzing..." : "🎯 Analyze & Get Suggestions"}
              </button>
            </form>

            {result ? (
              <div className="optimization-results">
                {/* Match Score */}
                <div className="score-section">
                  <div className="score-circle" data-score={result.matchScore}>
                    <svg viewBox="0 0 100 100" className="score-svg">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="var(--border-strong)"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={
                          result.matchScore >= 75
                            ? "var(--success)"
                            : result.matchScore >= 60
                            ? "#ffc454"
                            : "var(--danger)"
                        }
                        strokeWidth="8"
                        strokeDasharray={`${result.matchScore * 2.827} 283`}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="score-text">
                      <span className="score-number">{result.matchScore}</span>
                      <span className="score-label">Match Score</span>
                    </div>
                  </div>
                  <div className="score-interpretation">
                    <h3>
                      {result.matchScore >= 75
                        ? "🎉 Strong Match!"
                        : result.matchScore >= 60
                        ? "👍 Good Foundation"
                        : "⚠️ Needs Optimization"}
                    </h3>
                    <p>
                      {result.matchScore >= 75
                        ? "Your CV aligns well with the job requirements. Review the suggestions below for final touches."
                        : result.matchScore >= 60
                        ? "Your CV has potential. Apply the suggestions below to significantly improve your match."
                        : "Your CV needs tailoring for this role. Follow the high-priority suggestions to improve your chances."}
                    </p>
                  </div>
                </div>

                {/* Suggestions */}
                <div className="suggestions-container">
                  <h3 className="suggestions-title">💡 Personalized Optimization Suggestions</h3>
                  <p className="suggestions-subtitle">
                    Apply these changes to tailor your CV for this specific role
                  </p>

                  <div className="suggestions-list-optimized">
                    {result.suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className={`suggestion-card priority-${suggestion.priority}`}
                      >
                        <div className="suggestion-header">
                          <div className="suggestion-meta">
                            <span className={`priority-badge priority-${suggestion.priority}`}>
                              {suggestion.priority === "high" ? "🔴 High Priority" : 
                               suggestion.priority === "medium" ? "🟡 Medium Priority" : 
                               "🟢 Low Priority"}
                            </span>
                            <span className="section-badge">{suggestion.section}</span>
                            <span className={`type-badge type-${suggestion.type}`}>
                              {suggestion.type === "add" ? "➕ Add" :
                               suggestion.type === "improve" ? "✨ Improve" :
                               suggestion.type === "remove" ? "➖ Remove" :
                               "🔄 Reorder"}
                            </span>
                          </div>
                        </div>
                        <div className="suggestion-content">
                          <p className="suggestion-text">{suggestion.suggested}</p>
                          <p className="suggestion-reason">
                            <strong>Why:</strong> {suggestion.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Missing Keywords */}
                {result.missingKeywords.length > 0 && (
                  <div className="missing-keywords-section">
                    <h3>🎯 Missing Keywords ({result.missingKeywords.length})</h3>
                    <p className="section-description">
                      These keywords from the job description are not in your CV. Consider incorporating them where relevant:
                    </p>
                    <div className="keyword-tags">
                      {result.missingKeywords.map((keyword, index) => (
                        <span key={index} className="keyword-tag missing-tag">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optimized Resume Preview */}
                <div className="cover-letter-result">
                  <div className="result-header">
                    <h3>📄 Your CV with Optimization Notes</h3>
                    <div className="result-actions">
                      <button
                        className="secondary-button"
                        onClick={copyOptimizedResume}
                        type="button"
                      >
                        📋 Copy
                      </button>
                      <button
                        className="secondary-button"
                        onClick={downloadOptimizedResume}
                        type="button"
                      >
                        💾 Download
                      </button>
                    </div>
                  </div>
                  <div className="cover-letter-preview">
                    <pre>{result.optimizedResume}</pre>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
