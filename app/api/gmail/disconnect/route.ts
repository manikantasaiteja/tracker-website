/**
 * POST /api/gmail/disconnect
 *
 * Revokes the Google OAuth token and removes the stored credentials
 * for the authenticated user.
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client } from "@/lib/gmail/oauth";
import { getSupabaseAdmin } from "@/lib/gmail/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    // ── Authenticate the Supabase user ────────────────────────────────────
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

    const admin = getSupabaseAdmin();

    // ── Fetch the stored access token ─────────────────────────────────────
    const { data: tokenRow } = await admin
      .from("gmail_tokens")
      .select("access_token")
      .eq("user_id", user.id)
      .maybeSingle();

    // ── Revoke the token with Google ──────────────────────────────────────
    if (tokenRow?.access_token) {
      try {
        const oauth2Client = createOAuth2Client();
        await oauth2Client.revokeToken(tokenRow.access_token);
      } catch (revokeErr) {
        // Token may already be expired — still delete from DB
        console.warn("[disconnect] Token revoke failed (continuing):", revokeErr);
      }
    }

    // ── Delete token row from Supabase ────────────────────────────────────
    const { error: deleteError } = await admin
      .from("gmail_tokens")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[disconnect] DB delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to disconnect Gmail" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/gmail/disconnect] Error:", err);
    return NextResponse.json(
      { error: "Failed to disconnect Gmail" },
      { status: 500 }
    );
  }
}
