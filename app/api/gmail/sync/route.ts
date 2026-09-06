/**
 * POST /api/gmail/sync
 *
 * Fetches emails from the Gmail "Jobs" label, parses them,
 * and upserts matching job applications into the `applications` table.
 *
 * Rules:
 * - Only processes emails with the Gmail label "Jobs"
 * - Deduplicates by gmail_message_id (stored in gmail_sync_log)
 * - Matches existing applications by (user_id + company + role)
 *   → updates status + last_email_date if found
 *   → inserts a new application if not found
 */
import { google, gmail_v1 } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client } from "@/lib/gmail/oauth";
import { getSupabaseAdmin } from "@/lib/gmail/supabase-admin";
import { parseGmailMessage } from "@/lib/gmail/parser";

// How many emails to fetch per sync (avoids memory spikes)
const BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authenticate the Supabase user ─────────────────────────────────
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

    // ── 2. Load stored Gmail tokens for this user ─────────────────────────
    const { data: tokenRow, error: tokenError } = await admin
      .from("gmail_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenRow) {
      return NextResponse.json(
        { error: "Gmail not connected. Please connect your Gmail account first." },
        { status: 400 }
      );
    }

    // ── 3. Build OAuth client with stored tokens ──────────────────────────
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenRow.access_token,
      refresh_token: tokenRow.refresh_token,
      expiry_date: tokenRow.token_expiry
        ? new Date(tokenRow.token_expiry).getTime()
        : undefined,
    });

    // Auto-refresh if the token is expired or about to expire
    oauth2Client.on("tokens", async (newTokens) => {
      const update: Record<string, string> = {
        updated_at: new Date().toISOString(),
      };
      if (newTokens.access_token) update.access_token = newTokens.access_token;
      if (newTokens.refresh_token) update.refresh_token = newTokens.refresh_token;
      if (newTokens.expiry_date) {
        update.token_expiry = new Date(newTokens.expiry_date).toISOString();
      }
      await admin
        .from("gmail_tokens")
        .update(update)
        .eq("user_id", user.id);
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // ── 4. Resolve the "Jobs" label ID ────────────────────────────────────
    const { data: labelsData } = await gmail.users.labels.list({ userId: "me" });
    const jobsLabel = labelsData.labels?.find(
      (l) => l.name?.toLowerCase() === "jobs"
    );

    if (!jobsLabel?.id) {
      return NextResponse.json(
        {
          error:
            'Gmail label "Jobs" not found. Please create a label named exactly "Jobs" in your Gmail account.',
        },
        { status: 400 }
      );
    }

    // ── 5. Fetch message IDs under the Jobs label ─────────────────────────
    const { data: listData } = await gmail.users.messages.list({
      userId: "me",
      labelIds: [jobsLabel.id],
      maxResults: BATCH_SIZE,
    });

    const messageRefs = listData.messages ?? [];

    if (messageRefs.length === 0) {
      // Update last_sync_at and return
      await admin
        .from("gmail_tokens")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("user_id", user.id);

      return NextResponse.json({
        imported: 0,
        updated: 0,
        skipped: 0,
        message: 'No emails found under the "Jobs" label.',
      });
    }

    // ── 6. Filter out already-processed message IDs ───────────────────────
    const messageIds = messageRefs.map((m) => m.id!).filter(Boolean);

    const { data: existingLogs } = await admin
      .from("gmail_sync_log")
      .select("gmail_message_id")
      .eq("user_id", user.id)
      .in("gmail_message_id", messageIds);

    const alreadySynced = new Set(
      (existingLogs ?? []).map((r: { gmail_message_id: string }) => r.gmail_message_id)
    );

    const newMessageIds = messageIds.filter((id) => !alreadySynced.has(id));

    let imported = 0;
    let updated = 0;
    const skipped = alreadySynced.size;

    // ── 7. Fetch + process each new message ───────────────────────────────
    for (const msgId of newMessageIds) {
      try {
        const { data: fullMessage } = await gmail.users.messages.get({
          userId: "me",
          id: msgId,
          format: "full",
        });

        const parsed = parseGmailMessage(
          fullMessage as gmail_v1.Schema$Message & { id: string }
        );
        if (!parsed) continue;

        const dateApplied = parsed.dateReceived.split("T")[0] ?? new Date().toISOString().split("T")[0];

        // ── 8. Check for existing application (match by company + role) ───
        const { data: existing } = await admin
          .from("applications")
          .select("id, status")
          .eq("user_id", user.id)
          .ilike("company", parsed.company)
          .ilike("role", parsed.role)
          .maybeSingle();

        if (existing) {
          // Update existing application with latest status
          await admin
            .from("applications")
            .update({
              status: parsed.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          updated++;
        } else {
          // Insert new application
          await admin.from("applications").insert({
            user_id: user.id,
            company: parsed.company,
            role: parsed.role,
            status: parsed.status,
            date_applied: dateApplied,
            location: null,
            job_url: null,
          });
          imported++;
        }

        // ── 9. Record this message ID to prevent re-processing ───────────
        await admin.from("gmail_sync_log").insert({
          user_id: user.id,
          gmail_message_id: parsed.gmailMessageId,
          subject: parsed.subject,
          sender: parsed.sender,
          company: parsed.company,
          role: parsed.role,
          status_detected: parsed.status,
          synced_at: new Date().toISOString(),
        });
      } catch (msgErr) {
        console.error(`[sync] Error processing message ${msgId}:`, msgErr);
        // Continue with other messages rather than failing the whole sync
      }
    }

    // ── 10. Update last sync timestamp ────────────────────────────────────
    await admin
      .from("gmail_tokens")
      .update({
        last_sync_at: new Date().toISOString(),
        emails_imported: (tokenRow.emails_imported ?? 0) + imported,
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      imported,
      updated,
      skipped,
      total: messageRefs.length,
      message: `Sync complete: ${imported} new, ${updated} updated, ${skipped} already synced.`,
    });
  } catch (err) {
    console.error("[/api/gmail/sync] Unexpected error:", err);
    return NextResponse.json(
      { error: "Sync failed. Please try again." },
      { status: 500 }
    );
  }
}
