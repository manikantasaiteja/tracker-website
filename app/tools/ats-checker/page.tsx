"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ATSResult = {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  extractedRequirements: string;
};

export default function ATSCheckerPage() {
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
  const [manualCvText, setManualCvText] = useState("");
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<ATSResult | null>(null);
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
      // Dynamically import pdfjs-dist only on client side
      const pdfjsLib = await import("pdfjs-dist");
      
      // Configure worker - use unpkg as a reliable CDN that auto-resolves versions
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
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
      throw new Error("Failed to extract text from PDF. Please ensure it's a valid PDF file or try pasting the text directly.");
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

  function extractJobRequirements(jobText: string): string {
    // Keywords that indicate requirement sections (multilingual support)
    const requirementIndicators = [
      // English
      "requirements", "required", "qualifications", "skills", "experience",
      "responsibilities", "must have", "should have", "you will", "you'll",
      "looking for", "ideal candidate", "we need", "essential", "mandatory",
      "key skills", "technical skills", "competencies", "expertise",
      // Spanish
      "requisitos", "requerido", "calificaciones", "habilidades", "experiencia",
      // French
      "exigences", "requis", "compétences", "expérience",
      // German
      "anforderungen", "erforderlich", "qualifikationen", "fähigkeiten", "erfahrung",
      // Portuguese
      "requisitos", "requerido", "qualificações", "habilidades", "experiência",
      // Italian
      "requisiti", "richiesto", "qualifiche", "competenze", "esperienza",
    ];

    // Keywords to exclude (company info, benefits, etc.)
    const excludeIndicators = [
      // English
      "about us", "about the company", "who we are", "our mission", "our vision",
      "benefits", "perks", "we offer", "what we offer", "compensation", "salary",
      "equal opportunity", "diversity", "inclusion", "how to apply", "application process",
      "company culture", "our values", "our team", "founded in", "established",
      // Spanish
      "sobre nosotros", "beneficios", "ofrecemos",
      // French
      "à propos", "avantages", "nous offrons",
      // German
      "über uns", "vorteile", "wir bieten",
      // Portuguese
      "sobre nós", "benefícios", "oferecemos",
      // Italian
      "chi siamo", "benefici", "offriamo",
    ];

    const lines = jobText.split("\n");
    const relevantLines: string[] = [];
    let inRequirementSection = false;
    let inExcludeSection = false;

    for (const line of lines) {
      const lowerLine = line.toLowerCase().trim();
      
      if (!lowerLine) continue;

      // Check if we're entering an exclude section
      if (excludeIndicators.some(indicator => lowerLine.includes(indicator))) {
        inExcludeSection = true;
        inRequirementSection = false;
        continue;
      }

      // Check if we're entering a requirement section
      if (requirementIndicators.some(indicator => lowerLine.includes(indicator))) {
        inRequirementSection = true;
        inExcludeSection = false;
      }

      // Add lines that are in requirement sections or contain requirement keywords
      if (inRequirementSection && !inExcludeSection) {
        relevantLines.push(line);
      } else if (!inExcludeSection && requirementIndicators.some(indicator => lowerLine.includes(indicator))) {
        relevantLines.push(line);
      }

      // Reset sections on new headers (lines that are all caps or very short)
      if (line.length < 50 && line === line.toUpperCase() && line.length > 3) {
        inRequirementSection = false;
        inExcludeSection = false;
      }
    }

    // If we didn't find specific sections, return the full text (but still useful for keyword extraction)
    return relevantLines.length > 50 ? relevantLines.join("\n") : jobText;
  }

  function extractKeywords(text: string): string[] {
    // Expanded multilingual stop words
    const stopWords = new Set([
      // English
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
      "be", "have", "has", "had", "do", "does", "did", "will", "would", "should",
      "could", "may", "might", "must", "can", "this", "that", "these", "those",
      "i", "you", "he", "she", "it", "we", "they", "what", "which", "who",
      "when", "where", "why", "how", "all", "each", "every", "both", "few",
      "more", "most", "other", "some", "such", "no", "nor", "not", "only",
      "own", "same", "so", "than", "too", "very", "just", "about", "into",
      "through", "during", "before", "after", "above", "below", "up", "down",
      "out", "off", "over", "under", "again", "further", "then", "once",
      // Spanish
      "el", "la", "los", "las", "un", "una", "y", "o", "pero", "en", "con", "de", "para",
      // French
      "le", "la", "les", "un", "une", "et", "ou", "mais", "dans", "avec", "de", "pour",
      // German
      "der", "die", "das", "ein", "eine", "und", "oder", "aber", "in", "mit", "von", "für",
      // Portuguese
      "o", "a", "os", "as", "um", "uma", "e", "ou", "mas", "em", "com", "de", "para",
    ]);

    // Extract both single words and common phrases (2-3 words)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s\-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    // Count word frequency
    const wordCount = new Map<string, number>();
    words.forEach((word) => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Extract multi-word phrases (bigrams and trigrams)
    const phrases: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (bigram.length > 6) {
        phrases.push(bigram);
      }
      
      if (i < words.length - 2) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        if (trigram.length > 10) {
          phrases.push(trigram);
        }
      }
    }

    // Count phrase frequency
    phrases.forEach((phrase) => {
      wordCount.set(phrase, (wordCount.get(phrase) || 0) + 1);
    });

    // Return top keywords (prioritize those that appear multiple times)
    return Array.from(wordCount.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([word]) => word);
  }

  function analyzeATS(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    // Get CV text from either PDF extraction or manual input
    const finalCvText = inputMode === "pdf" ? cvText : manualCvText;

    if (!finalCvText.trim() || !jobDescription.trim()) {
      setError("Please provide your CV text (upload PDF or paste text) and the job description.");
      return;
    }

    setAnalyzing(true);

    try {
      // Extract only relevant job requirements
      const relevantJobText = extractJobRequirements(jobDescription);
      
      const jobKeywords = extractKeywords(relevantJobText);
      const cvKeywords = extractKeywords(finalCvText);

      // Create a more flexible matching system (partial matches)
      const cvKeywordsSet = new Set(cvKeywords);
      const cvTextLower = finalCvText.toLowerCase();
      
      const matchedKeywords = jobKeywords.filter((keyword) => {
        // Exact match
        if (cvKeywordsSet.has(keyword)) return true;
        
        // Partial match (keyword appears in CV text)
        if (cvTextLower.includes(keyword)) return true;
        
        // Check if any CV keyword contains this job keyword
        return Array.from(cvKeywordsSet).some(cvKeyword => 
          cvKeyword.includes(keyword) || keyword.includes(cvKeyword)
        );
      });

      const missingKeywords = jobKeywords.filter(
        (keyword) => !matchedKeywords.includes(keyword)
      );

      const score = jobKeywords.length > 0
        ? Math.round((matchedKeywords.length / jobKeywords.length) * 100)
        : 0;

      const suggestions: string[] = [];
      
      if (score < 60) {
        suggestions.push(
          "⚠️ Your CV has low keyword match. Consider incorporating more relevant terms from the job requirements."
        );
        suggestions.push(
          "💡 Focus on adding technical skills, tools, and qualifications mentioned in the job posting."
        );
      }
      
      if (missingKeywords.length > 0) {
        const topMissing = missingKeywords.slice(0, 5).join(", ");
        suggestions.push(
          `🎯 Priority keywords to add: ${topMissing}${missingKeywords.length > 5 ? "..." : ""}`
        );
      }

      if (score >= 60 && score < 75) {
        suggestions.push(
          "👍 Good match! Consider adding a few more relevant keywords to improve your score."
        );
      }

      if (score >= 75) {
        suggestions.push(
          "🎉 Excellent match! Your CV aligns well with the job requirements."
        );
      }

      suggestions.push(
        "📝 Use exact phrases from the job description where they match your actual experience."
      );
      
      suggestions.push(
        "🔤 Include both full terms and acronyms (e.g., 'Artificial Intelligence (AI)', 'Search Engine Optimization (SEO)')."
      );

      if (finalCvText.length < 500) {
        suggestions.push(
          "📄 Your CV seems short. Consider adding more details about your experience, achievements, and projects."
        );
      }

      suggestions.push(
        "✨ Quantify your achievements with numbers and metrics when possible (e.g., 'Increased sales by 30%')."
      );

      setResult({
        score,
        matchedKeywords: matchedKeywords.slice(0, 20),
        missingKeywords: missingKeywords.slice(0, 20),
        suggestions,
        extractedRequirements: relevantJobText,
      });
    } catch (err) {
      setError("Failed to analyze. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading || !supabase) {
    return (
      <main className="route-loader">
        <div className="route-loader__pulse" />
        <p>Loading ATS Checker...</p>
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
          <section className="tool-card">
            <div className="tool-header">
              <div className="tool-icon">📊</div>
              <div>
                <h2 className="tool-title">ATS Score Checker</h2>
                <p className="tool-description">
                  Upload your CV (PDF) and paste any job description in any language. Our intelligent system extracts only the relevant requirements, filters out company info and benefits, and gives you an accurate compatibility score with actionable suggestions.
                </p>
              </div>
            </div>

            <form className="ats-form" onSubmit={analyzeATS}>
              <div className="ats-input-group">
                <div className="input-mode-selector">
                  <label className="mode-option">
                    <input
                      type="radio"
                      name="inputMode"
                      value="pdf"
                      checked={inputMode === "pdf"}
                      onChange={() => {
                        setInputMode("pdf");
                        setManualCvText("");
                        setError(null);
                      }}
                    />
                    <span>📄 Upload PDF</span>
                  </label>
                  <label className="mode-option">
                    <input
                      type="radio"
                      name="inputMode"
                      value="text"
                      checked={inputMode === "text"}
                      onChange={() => {
                        setInputMode("text");
                        setCvFile(null);
                        setCvText("");
                        setError(null);
                      }}
                    />
                    <span>✍️ Paste Text</span>
                  </label>
                </div>

                {inputMode === "pdf" ? (
                  <label className="ats-label">
                    <span className="label-text">
                      <strong className="required-field">Upload Your CV (PDF)</strong>
                      <span className="label-hint">Upload your CV in PDF format for automatic text extraction</span>
                    </span>
                    <div className="file-upload-zone">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleCVUpload}
                        className="file-input-hidden"
                        id="cv-upload"
                        required={inputMode === "pdf" && !cvText}
                      />
                      <label htmlFor="cv-upload" className="file-upload-label">
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
                              <strong>Click to upload CV</strong>
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
                ) : (
                  <label className="ats-label">
                    <span className="label-text">
                      <strong className="required-field">Your CV Text</strong>
                      <span className="label-hint">Paste your CV content directly as text</span>
                    </span>
                    <textarea
                      className="ats-textarea"
                      onChange={(event) => setManualCvText(event.target.value)}
                      placeholder="Paste your CV text here... Include your experience, skills, education, and achievements."
                      required={inputMode === "text"}
                      rows={12}
                      value={manualCvText}
                    />
                    <span className="char-count">{manualCvText.length} characters</span>
                  </label>
                )}

                <label className="ats-label">
                  <span className="label-text">
                    <strong className="required-field">Job Description</strong>
                    <span className="label-hint">Paste the complete job posting (we'll extract the relevant requirements)</span>
                  </span>
                  <textarea
                    className="ats-textarea"
                    onChange={(event) => setJobDescription(event.target.value)}
                    placeholder="Paste the full job description here... Include everything - we'll automatically filter out company info, benefits, and extract only the relevant requirements, skills, and qualifications. Works in any language!"
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
                disabled={analyzing || extracting || (inputMode === "pdf" ? !cvText : !manualCvText)}
                type="submit"
              >
                {analyzing ? "🔄 Analyzing..." : "🔍 Analyze ATS Score"}
              </button>
            </form>

            {result ? (
              <div className="ats-results">
                <div className="score-section">
                  <div className="score-circle" data-score={result.score}>
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
                          result.score >= 75
                            ? "var(--success)"
                            : result.score >= 60
                            ? "#ffc454"
                            : "var(--danger)"
                        }
                        strokeWidth="8"
                        strokeDasharray={`${result.score * 2.827} 283`}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="score-text">
                      <span className="score-number">{result.score}</span>
                      <span className="score-label">ATS Score</span>
                    </div>
                  </div>
                  <div className="score-interpretation">
                    <h3>
                      {result.score >= 75
                        ? "🎉 Excellent Match!"
                        : result.score >= 60
                        ? "👍 Good Match"
                        : "⚠️ Needs Improvement"}
                    </h3>
                    <p>
                      {result.score >= 75
                        ? "Your CV is highly optimized for this job posting."
                        : result.score >= 60
                        ? "Your CV has a decent match. A few improvements could help."
                        : "Your CV needs more relevant keywords to pass ATS filters."}
                    </p>
                  </div>
                </div>

                <div className="keywords-section">
                  <div className="keyword-box matched">
                    <h3>✅ Matched Keywords ({result.matchedKeywords.length})</h3>
                    <div className="keyword-tags">
                      {result.matchedKeywords.map((keyword, index) => (
                        <span key={index} className="keyword-tag matched-tag">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="keyword-box missing">
                    <h3>❌ Missing Keywords ({result.missingKeywords.length})</h3>
                    <div className="keyword-tags">
                      {result.missingKeywords.map((keyword, index) => (
                        <span key={index} className="keyword-tag missing-tag">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="suggestions-section">
                  <h3>💡 Suggestions to Improve Your ATS Score</h3>
                  <ul className="suggestions-list">
                    {result.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>

                {result.extractedRequirements && result.extractedRequirements !== jobDescription && (
                  <details className="extracted-requirements">
                    <summary>🎯 Extracted Job Requirements (filtered from full description)</summary>
                    <div className="requirements-content">
                      {result.extractedRequirements}
                    </div>
                  </details>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
