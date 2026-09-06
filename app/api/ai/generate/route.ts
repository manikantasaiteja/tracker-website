/**
 * POST /api/ai/generate
 *
 * Shared AI endpoint for all tools — powered by Groq (free forever).
 * Uses llama-3.3-70b-versatile via Groq's OpenAI-compatible API.
 *
 * Tool types:
 *  - "ats"          → ATS score + matched/missing keywords + suggestions
 *  - "resume"       → Optimisation suggestions + missing keywords + match score
 *  - "cover-letter" → Full personalised cover letter text
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type ToolType = "ats" | "resume" | "cover-letter";

type RequestBody = {
  tool: ToolType;
  cvText: string;
  jobDescription: string;
  userInfo?: { fullName: string; email: string; phone: string };
};

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildATSPrompt(cvText: string, jobDescription: string): string {
  return `You are an expert ATS (Applicant Tracking System) analyst. Analyse the CV against the job description and return ONLY a valid JSON object — no markdown, no code fences, no extra text.

CV:
"""
${cvText.slice(0, 6000)}
"""

Job Description:
"""
${jobDescription.slice(0, 4000)}
"""

Return this exact JSON structure:
{
  "score": <integer 0-100>,
  "matchedKeywords": [<up to 20 matched keyword strings>],
  "missingKeywords": [<up to 20 missing keyword strings>],
  "suggestions": [<5-8 specific actionable suggestion strings>],
  "summary": "<2-3 sentence overall assessment>"
}`;
}

function buildResumePrompt(cvText: string, jobDescription: string): string {
  return `You are a professional resume coach and ATS optimisation expert. Analyse the CV against the job description and return ONLY a valid JSON object — no markdown, no code fences, no extra text.

CV:
"""
${cvText.slice(0, 6000)}
"""

Job Description:
"""
${jobDescription.slice(0, 4000)}
"""

Return this exact JSON structure:
{
  "matchScore": <integer 0-100>,
  "missingKeywords": [<up to 20 keyword strings to add to CV>],
  "suggestions": [
    {
      "section": "<CV section name e.g. Skills, Experience, Summary>",
      "type": "<one of: add | improve | remove | reorder>",
      "priority": "<one of: high | medium | low>",
      "suggested": "<specific actionable suggestion>",
      "reason": "<why this improves ATS score or recruiter appeal>"
    }
  ],
  "summary": "<2-3 sentence overall assessment of the CV for this role>"
}

Provide 6-10 suggestions ordered by priority (high first).`;
}

function buildCoverLetterPrompt(
  cvText: string,
  jobDescription: string,
  userInfo: { fullName: string; email: string; phone: string }
): string {
  return `You are an expert career coach. Write a professional, personalised cover letter.

Candidate:
- Name: ${userInfo.fullName}
- Email: ${userInfo.email}
- Phone: ${userInfo.phone}

CV:
"""
${cvText.slice(0, 5000)}
"""

Job Description:
"""
${jobDescription.slice(0, 3000)}
"""

Instructions:
- Write a complete ready-to-send cover letter with no placeholders
- Extract company name and job title from the job description
- Highlight 2-3 specific skills from the CV that match the job
- 3-4 paragraphs, professional but warm tone
- Strong opening sentence, clear call to action at the end
- Return ONLY the cover letter text — no JSON, no markdown, no extra commentary`;
}

// ── Groq API call ─────────────────────────────────────────────────────────────

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a helpful career assistant. Follow instructions precisely.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[callGroq] API error:", res.status, errText);
    if (res.status === 401 || res.status === 403) throw new Error("API_KEY_INVALID");
    if (res.status === 429) throw new Error("QUOTA_EXCEEDED");
    throw new Error(`Groq API returned ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from AI.");
  return text.trim();
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Authenticate Supabase user
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Parse body
    const body: RequestBody = await request.json();
    const { tool, cvText, jobDescription, userInfo } = body;

    if (!tool || !cvText?.trim() || !jobDescription?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: tool, cvText, jobDescription" },
        { status: 400 }
      );
    }

    // Check API key
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "your-groq-api-key-here") {
      return NextResponse.json(
        { error: "AI not configured. Add GROQ_API_KEY to your .env.local file." },
        { status: 503 }
      );
    }

    // Build prompt
    let prompt: string;
    if (tool === "ats") {
      prompt = buildATSPrompt(cvText, jobDescription);
    } else if (tool === "resume") {
      prompt = buildResumePrompt(cvText, jobDescription);
    } else if (tool === "cover-letter") {
      prompt = buildCoverLetterPrompt(cvText, jobDescription, userInfo ?? { fullName: "", email: "", phone: "" });
    } else {
      return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    // Call Groq
    const responseText = await callGroq(prompt, apiKey);

    // Return result
    if (tool === "cover-letter") {
      return NextResponse.json({ coverLetter: responseText });
    }

    // Strip markdown fences if present
    const cleaned = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);

  } catch (err) {
    console.error("[/api/ai/generate] Error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message === "QUOTA_EXCEEDED") {
      return NextResponse.json({ error: "AI quota exceeded. Please wait a moment and try again." }, { status: 429 });
    }
    if (message === "API_KEY_INVALID") {
      return NextResponse.json({ error: "Invalid Groq API key. Check GROQ_API_KEY in .env.local." }, { status: 503 });
    }
    return NextResponse.json({ error: `AI generation failed: ${message}` }, { status: 500 });
  }
}
