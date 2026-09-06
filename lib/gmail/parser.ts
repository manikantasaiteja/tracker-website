/**
 * Gmail email parser.
 * Extracts job application fields from a raw Gmail message and
 * classifies the application status from subject + body keywords.
 */
import type { ApplicationStatus } from "@/lib/types";

// ─── Keyword maps ────────────────────────────────────────────────────────────

const STATUS_KEYWORDS: Record<ApplicationStatus, string[]> = {
  Interview: [
    "interview",
    "schedule",
    "hiring manager",
    "meet with",
    "invite you to",
    "next step",
    "next steps",
    "call with",
    "video call",
    "phone screen",
  ],
  Offer: [
    "offer",
    "congratulations",
    "pleased to offer",
    "we are delighted",
    "we'd like to offer",
    "job offer",
    "formal offer",
  ],
  Rejected: [
    "unfortunately",
    "not selected",
    "not moving forward",
    "regret",
    "decided to",
    "other candidates",
    "position has been filled",
    "won't be moving",
    "will not be moving",
    "not a fit",
  ],
  Assessment: [
    "assessment",
    "coding challenge",
    "technical test",
    "take-home",
    "task",
    "assignment",
    "test your",
    "skills test",
    "online test",
  ],
  Ghosted: [],    // never detected via keywords — used for manual override
  Withdrawn: [], // never detected via keywords — used for manual override
  Applied: [],   // fallback when no other keywords match
};

// ─── Status detection ─────────────────────────────────────────────────────────

/**
 * Classify the application status from email subject + body text.
 * Order matters: more specific statuses are checked first.
 */
export function detectStatus(subject: string, body: string): ApplicationStatus {
  const text = `${subject} ${body}`.toLowerCase();

  const priority: ApplicationStatus[] = [
    "Offer",
    "Rejected",
    "Interview",
    "Assessment",
  ];

  for (const status of priority) {
    const keywords = STATUS_KEYWORDS[status];
    if (keywords.some((kw) => text.includes(kw))) {
      return status;
    }
  }

  return "Applied";
}

// ─── Gmail message decoding ──────────────────────────────────────────────────

/** Decode base64url-encoded Gmail message body */
export function decodeBase64Url(encoded: string): string {
  try {
    // Replace URL-safe chars and decode
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/** Recursively extract plain-text body from Gmail message parts */
export function extractBody(
  payload: GmailMessagePayload
): string {
  // Direct body data on the payload itself
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (!payload.parts) return "";

  // Prefer text/plain; fall back to text/html
  const plainPart = payload.parts.find((p) => p.mimeType === "text/plain");
  if (plainPart?.body?.data) {
    return decodeBase64Url(plainPart.body.data);
  }

  const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
  if (htmlPart?.body?.data) {
    // Strip HTML tags for keyword matching
    return decodeBase64Url(htmlPart.body.data).replace(/<[^>]+>/g, " ");
  }

  // Recurse into nested multipart parts
  for (const part of payload.parts) {
    const text = extractBody(part);
    if (text) return text;
  }

  return "";
}

// ─── Company / role extraction ───────────────────────────────────────────────

/**
 * Extract sender domain as a company name fallback.
 * e.g. "recruiting@google.com" → "Google"
 */
export function extractCompanyFromSender(sender: string): string {
  const emailMatch = sender.match(/<(.+?)>/) ?? sender.match(/(\S+@\S+)/);
  const email = emailMatch?.[1] ?? emailMatch?.[0] ?? sender;
  const domain = email.split("@")[1] ?? "";

  // Remove common recruiting subdomains and TLD
  const cleaned = domain
    .replace(/^(recruiting|jobs|careers|talent|hr|noreply|no-reply)\./i, "")
    .replace(/\.(com|io|co|org|net|ai|app)(\..*)?$/, "");

  // Capitalise each word
  return cleaned
    .split(/[\.\-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .trim();
}

/**
 * Try to extract a job title from the email subject.
 * Looks for patterns like "Application for Senior Engineer at Acme"
 */
export function extractRoleFromSubject(subject: string): string {
  const patterns = [
    /application (?:for|re:|regarding) (.+?) (?:at|@|with|–|-)/i,
    /(?:your|the) (.+?) (?:role|position|opening|opportunity)/i,
    /(?:re:|regarding:?) (.+?) (?:at|@|with)/i,
    /(?:interview|offer|assessment) for (.+?) (?:at|@|with|–|-)/i,
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  // Fallback: use the full subject trimmed to 80 chars
  return subject.slice(0, 80).trim();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type GmailMessagePayload = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePayload[];
  headers?: Array<{ name: string; value: string }>;
};

export type ParsedEmail = {
  gmailMessageId: string;
  subject: string;
  sender: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  dateReceived: string; // ISO string
  snippet: string;
};

/**
 * Parse a raw Gmail API message object into a structured ParsedEmail.
 */
export function parseGmailMessage(
  message: {
    id: string;
    snippet?: string;
    internalDate?: string;
    payload?: GmailMessagePayload;
  }
): ParsedEmail | null {
  try {
    const payload = message.payload;
    if (!payload) return null;

    const headers = payload.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    const subject = getHeader("Subject");
    const sender = getHeader("From");
    const dateStr = getHeader("Date");

    const body = extractBody(payload);
    const status = detectStatus(subject, body);
    const company = extractCompanyFromSender(sender);
    const role = extractRoleFromSubject(subject);

    // Parse date — prefer internalDate (epoch ms) over header string
    const dateReceived = message.internalDate
      ? new Date(parseInt(message.internalDate, 10)).toISOString()
      : new Date(dateStr).toISOString();

    return {
      gmailMessageId: message.id,
      subject,
      sender,
      company,
      role,
      status,
      dateReceived,
      snippet: message.snippet ?? "",
    };
  } catch {
    return null;
  }
}
