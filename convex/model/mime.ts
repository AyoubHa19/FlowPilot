// Email parsing and building for the Gmail API. Pure functions, no I/O.

export type GmailHeader = { name: string; value: string };
export type GmailPart = {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};

export function header(headers: GmailHeader[] | undefined, name: string) {
  const lower = name.toLowerCase();
  return headers?.find((h) => h.name.toLowerCase() === lower)?.value;
}

/** "Felix Braun <Felix.Braun@Example.com>" → name + lowercase email. */
export function parseAddress(value: string): { name?: string; email: string } {
  const angle = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  if (angle) {
    const name = angle[1].trim();
    return { name: name || undefined, email: angle[2].trim().toLowerCase() };
  }
  return { email: value.trim().toLowerCase() };
}

export function base64UrlToBytes(data: string) {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function utf8ToBase64(text: string) {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function bytesToBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function charsetOf(part: GmailPart) {
  const contentType = header(part.headers, "Content-Type") ?? "";
  return /charset="?([^";\s]+)"?/i.exec(contentType)?.[1]?.toLowerCase() ?? "utf-8";
}

function decodePart(part: GmailPart) {
  if (!part.body?.data) return "";
  const bytes = base64UrlToBytes(part.body.data);
  try {
    return new TextDecoder(charsetOf(part)).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", euro: "€",
};

/** Turns email HTML into readable plain text. The HTML itself is discarded. */
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (match, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
      return ENTITIES[code] ?? match;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findPart(part: GmailPart, mimeType: string): GmailPart | undefined {
  if (part.mimeType?.toLowerCase() === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return undefined;
}

/** Plain text body: text/plain if present, else text/html converted to text. */
export function extractBodyText(payload: GmailPart) {
  const plain = findPart(payload, "text/plain");
  if (plain) return decodePart(plain).replace(/\r\n/g, "\n").trim();
  const html = findPart(payload, "text/html");
  return html ? htmlToText(decodePart(html)) : "";
}

/** RFC 2047 encoded-word for non-ASCII header values (subjects with umlauts). */
export function encodeHeaderValue(value: string) {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${utf8ToBase64(value)}?=`;
}

export function replySubject(subject: string) {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

/** Strips CR/LF so a value cannot inject extra headers. */
function oneLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export type ReplyInput = {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
};

/**
 * An RFC 2822 reply. In-Reply-To and References (plus the Gmail threadId on
 * send) are what keep the reply in the same conversation for both sides.
 */
export function buildReplyMime(input: ReplyInput) {
  const references = [input.references, input.inReplyTo].filter(Boolean).join(" ").trim();
  const body = utf8ToBase64(input.body.replace(/\r?\n/g, "\r\n"));
  const lines = [
    `From: ${oneLine(input.from)}`,
    `To: ${oneLine(input.to)}`,
    `Subject: ${encodeHeaderValue(oneLine(replySubject(input.subject)))}`,
    ...(input.inReplyTo ? [`In-Reply-To: ${oneLine(input.inReplyTo)}`] : []),
    ...(references ? [`References: ${oneLine(references)}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    ...(body.match(/.{1,76}/g) ?? [""]),
  ];
  return lines.join("\r\n");
}

/** First ~140 characters of the body, on one line. */
export function snippetOf(text: string) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}
