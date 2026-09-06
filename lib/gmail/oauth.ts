/**
 * Gmail OAuth helper — creates and configures the Google OAuth2 client.
 * Used by both the auth/callback routes and the sync route.
 */
import { OAuth2Client } from "google-auth-library";

/** Read and validate required Google OAuth env vars */
function getGoogleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth env vars. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI."
    );
  }

  return { clientId, clientSecret, redirectUri };
}

/** Create a fresh OAuth2 client */
export function createOAuth2Client(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = getGoogleEnv();
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

/**
 * The only Gmail scope we request — read-only access.
 * This is the minimum required to fetch email content.
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "email", // needed to read the connected account's email address
  "profile",
];
