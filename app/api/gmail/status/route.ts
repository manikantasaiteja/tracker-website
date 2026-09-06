/**
 * GET /api/gmail/status
 *
 * Returns the current Gmail connection status for the authenticated user.
 * Used by the Settings UI to show connected email, last sync time, and stats.
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/gmail/supabase-admin";

export async function GET(request: NextRequest) {
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

    // ── Fetch token row ───────────────────────────────────────────────────
    const { data: tokenRow } = await admin
      .from("gmail_tokens")
      .select("gmail_email, last_sync_at, emails_imported, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tokenRow) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      gmailEmail: tokenRow.gmail_email,
      lastSyncAt: tokenRow.last_sync_at,
      emailsImported: tokenRow.emails_imported ?? 0,
      connectedAt: tokenRow.updated_at,
    });
  } catch (err) {
    console.error("[/api/gmail/status] Error:", err);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
