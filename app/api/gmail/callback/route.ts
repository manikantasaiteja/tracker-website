/**
 * GET /api/gmail/callback
 *
 * Google OAuth 2.0 callback handler.
 * Exchanges the authorization code for access + refresh tokens,
 * then stores them in the `gmail_tokens` Supabase table.
 * Redirects back to /profile on success or failure.
 */
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client } from "@/lib/gmail/oauth";
import { getSupabaseAdmin } from "@/lib/gmail/supabase-admin";

export async function GET(request: NextRequest) {
  // Use the request's own origin as fallback so redirects always work
  const origin = process.env.NEXT_PUBLIC_APP_URL
    ?? new URL(request.url).origin;
  const profileUrl = `${origin}/profile`;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // ── Handle user-denied consent ────────────────────────────────────────
    if (error) {
      console.warn("[/api/gmail/callback] OAuth error:", error);
      return NextResponse.redirect(`${profileUrl}?gmail_error=access_denied`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${profileUrl}?gmail_error=missing_params`);
    }

    // ── Decode state to get the Supabase user ID ──────────────────────────
    let userId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
      userId = decoded.userId;
    } catch {
      return NextResponse.redirect(`${profileUrl}?gmail_error=invalid_state`);
    }

    if (!userId) {
      return NextResponse.redirect(`${profileUrl}?gmail_error=invalid_state`);
    }

    // ── Exchange code for tokens ──────────────────────────────────────────
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(`${profileUrl}?gmail_error=no_access_token`);
    }

    // ── Get the connected Gmail address ───────────────────────────────────
    oauth2Client.setCredentials(tokens);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client as any });
    const { data: googleUser } = await oauth2.userinfo.get();
    const gmailEmail = googleUser.email ?? "";

    // ── Store tokens in Supabase (upsert) ────────────────────────────────
    const admin = getSupabaseAdmin();

    const { error: upsertError } = await admin
      .from("gmail_tokens")
      .upsert(
        {
          user_id: userId,
          gmail_email: gmailEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expiry: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          scope: tokens.scope ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("[/api/gmail/callback] DB upsert error:", upsertError);
      return NextResponse.redirect(`${profileUrl}?gmail_error=db_error`);
    }

    // ── Success — redirect back to profile ────────────────────────────────
    return NextResponse.redirect(`${profileUrl}?gmail_connected=true`);
  } catch (err) {
    console.error("[/api/gmail/callback] Unexpected error:", err);
    return NextResponse.redirect(`${profileUrl}?gmail_error=server_error`);
  }
}
