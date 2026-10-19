// Thin Gmail REST client. Every call retries 3 times with exponential backoff
// on rate limits, server errors and network failures (PRD guardrail).

import type { GmailPart } from "./mime";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const RETRIES = 3;
const BASE_DELAY_MS = 500;

/** The refresh token is expired or revoked: the user must reconnect. */
export class GmailAuthError extends Error {}

/** Gmail no longer has the history we asked for: start from a fresh cursor. */
export class HistoryExpiredError extends Error {}

export function oauthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!clientId || !clientSecret || !siteUrl) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not set");
  }
  return { clientId, clientSecret, redirectUri: `${siteUrl}/gmail/oauth/callback` };
}

export function authorizationUrl(state: string) {
  const { clientId, redirectUri } = oauthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    // offline + consent: Google returns a refresh token every time.
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `idempotent: false` (sending mail) retries only 429, where Gmail
 * explicitly did nothing. A 5xx or dropped connection may still have
 * delivered the message, and a retry would send it twice.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { idempotent = true } = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, init);
      const retryable = response.status === 429 || (idempotent && response.status >= 500);
      if (!retryable || attempt === RETRIES) return response;
    } catch (error) {
      if (!idempotent || attempt === RETRIES) throw error;
    }
    await sleep(BASE_DELAY_MS * 2 ** attempt);
  }
}

async function tokenRequest(body: Record<string, string>) {
  const { clientId, clientSecret } = oauthConfig();
  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !json.access_token) {
    const reason = json.error_description ?? json.error ?? `HTTP ${response.status}`;
    if (json.error === "invalid_grant") throw new GmailAuthError(reason);
    throw new Error(`Google token request failed: ${reason}`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    // Refresh a minute early.
    expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000,
  };
}

export async function exchangeCode(code: string) {
  return await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: oauthConfig().redirectUri,
  });
}

export async function refreshAccessToken(refreshToken: string) {
  return await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

async function gmail<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  options?: { idempotent: boolean },
): Promise<T> {
  const response = await fetchWithRetry(
    `${API}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
    options,
  );
  if (response.status === 401) throw new GmailAuthError("Gmail rejected the access token");
  if (response.status === 404 && path.startsWith("/history")) {
    throw new HistoryExpiredError("History cursor is too old");
  }
  if (!response.ok) {
    throw new Error(`Gmail ${path.split("?")[0]} failed: HTTP ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export async function getProfile(accessToken: string) {
  return await gmail<{ emailAddress: string; historyId: string }>(accessToken, "/profile");
}

/** Ids of messages added to the inbox since `startHistoryId`, oldest first. */
export async function listInboxAdditions(accessToken: string, startHistoryId: string) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  let historyId = startHistoryId;
  do {
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: "messageAdded",
      labelId: "INBOX",
      ...(pageToken && { pageToken }),
    });
    const page = await gmail<{
      history?: { messagesAdded?: { message: { id: string } }[] }[];
      historyId: string;
      nextPageToken?: string;
    }>(accessToken, `/history?${params}`);
    for (const entry of page.history ?? []) {
      for (const added of entry.messagesAdded ?? []) ids.push(added.message.id);
    }
    historyId = page.historyId;
    pageToken = page.nextPageToken;
  } while (pageToken);
  return { ids: [...new Set(ids)], historyId };
}

/** Recent inbox message ids, used to bootstrap when there is no cursor yet. */
export async function listRecentInbox(accessToken: string, max = 20) {
  const params = new URLSearchParams({ labelIds: "INBOX", q: "newer_than:2d", maxResults: String(max) });
  const page = await gmail<{ messages?: { id: string }[] }>(accessToken, `/messages?${params}`);
  return (page.messages ?? []).map((m) => m.id).reverse();
}

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate: string;
  payload: GmailPart;
};

export async function getMessage(accessToken: string, id: string) {
  return await gmail<GmailMessage>(accessToken, `/messages/${id}?format=full`);
}

export async function sendRaw(accessToken: string, raw: string, threadId: string) {
  return await gmail<{ id: string; threadId: string }>(
    accessToken,
    "/messages/send",
    { method: "POST", body: JSON.stringify({ raw, threadId }) },
    { idempotent: false },
  );
}
