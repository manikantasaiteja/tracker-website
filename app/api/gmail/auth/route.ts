/**
 * GET /api/gmail/auth
 *
 * Initiates the Google OAuth 2.0 flow.
 * Requires the user to be authenticated with Supabase first.
 * Embeds the Supabase user ID in the OAuth `state` param so we can
 * associate the Google token with the correct user on callback.
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client, GMAIL_SCOPES } from "@/lib/gmail/oauth";

export async function GET(request: NextRequest) {
  try {
    // ── 1. Verify the user is logged in via Supabase ──────────────────────
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Build the Google OAuth URL ─────────────────────────────────────
    const oauth2Client = createOAuth2Client();

    // Encode the user ID in state so callback can retrieve it
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString(
      "base64url"
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",   // request refresh_token
      scope: GMAIL_SCOPES,
      prompt: "consent",        // always show consent to get refresh_token
      state,
    });

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error("[/api/gmail/auth] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate auth URL: ${message}` },
      { status: 500 }
    );
  }
}
