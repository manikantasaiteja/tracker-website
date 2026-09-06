import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  return NextResponse.json({
    GOOGLE_CLIENT_ID_START: clientId ? clientId.slice(0, 30) : "MISSING",
    GOOGLE_CLIENT_ID_END: clientId ? clientId.slice(-20) : "MISSING",
    GOOGLE_CLIENT_ID_LENGTH: clientId ? clientId.length : 0,
    GOOGLE_CLIENT_SECRET: clientSecret
      ? `set (ends in ...${clientSecret.slice(-6)})`
      : "MISSING",
    GOOGLE_REDIRECT_URI: redirectUri ?? "MISSING",
  });
}
