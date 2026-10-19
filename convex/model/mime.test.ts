import { describe, expect, test } from "vitest";
import {
  base64UrlToBytes,
  buildReplyMime,
  bytesToBase64Url,
  encodeHeaderValue,
  extractBodyText,
  type GmailPart,
  htmlToText,
  parseAddress,
  replySubject,
  utf8ToBase64,
} from "./mime";

const b64url = (text: string) => bytesToBase64Url(new TextEncoder().encode(text));
const decode = (data: string) => new TextDecoder().decode(base64UrlToBytes(data));

describe("parseAddress", () => {
  test("name and email, email lowercased", () => {
    expect(parseAddress("Felix Braun <Felix.Braun@Example.com>")).toEqual({
      name: "Felix Braun",
      email: "felix.braun@example.com",
    });
    expect(parseAddress('"Braun, Felix" <felix@example.com>')).toEqual({
      name: "Braun, Felix",
      email: "felix@example.com",
    });
    expect(parseAddress(" Anna@Example.com ")).toEqual({ email: "anna@example.com" });
  });
});

describe("base64url", () => {
  test("round-trips UTF-8 with umlauts", () => {
    const text = "Heizung in der Lindenstraße fällt aus – 25 €";
    expect(decode(b64url(text))).toBe(text);
  });
});

describe("extractBodyText", () => {
  test("prefers text/plain inside multipart/alternative", () => {
    const payload: GmailPart = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64url("Hallo, die Heizung ist kaputt.") } },
        { mimeType: "text/html", body: { data: b64url("<p>Hallo, <b>HTML</b></p>") } },
      ],
    };
    expect(extractBodyText(payload)).toBe("Hallo, die Heizung ist kaputt.");
  });

  test("finds the text part in nested multipart/mixed with attachments", () => {
    const payload: GmailPart = {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [{ mimeType: "text/plain", body: { data: b64url("Photo of the leak attached.") } }],
        },
        { mimeType: "image/jpeg", body: { size: 1234 } },
      ],
    };
    expect(extractBodyText(payload)).toBe("Photo of the leak attached.");
  });

  test("converts HTML-only mail to text and drops scripts", () => {
    const html =
      "<html><head><style>p{}</style></head><body><p>Dear landlord,</p><script>alert(1)</script><p>the sink &amp; the tap leak.<br>Thanks</p></body></html>";
    const payload: GmailPart = { mimeType: "text/html", body: { data: b64url(html) } };
    expect(extractBodyText(payload)).toBe("Dear landlord,\nthe sink & the tap leak.\nThanks");
  });

  test("decodes the declared charset", () => {
    const latin1 = new Uint8Array([0x53, 0x74, 0x72, 0x61, 0xdf, 0x65]); // "Straße"
    const payload: GmailPart = {
      mimeType: "text/plain",
      headers: [{ name: "Content-Type", value: 'text/plain; charset="iso-8859-1"' }],
      body: { data: bytesToBase64Url(latin1) },
    };
    expect(extractBodyText(payload)).toBe("Straße");
  });
});

describe("htmlToText", () => {
  test("decodes numeric and named entities", () => {
    expect(htmlToText("Gr&uuml;&szlig;e &#8211; &#x20AC;5")).toBe("Grüße – €5");
  });
});

describe("buildReplyMime", () => {
  const mime = buildReplyMime({
    from: "flowpilot.demo@gmail.com",
    to: "Felix Braun <felix.braun@example.com>",
    subject: "Heizung fällt aus",
    body: "Hallo Felix,\nwir schicken morgen einen Techniker.",
    inReplyTo: "<abc@mail.gmail.com>",
    references: "<root@mail.gmail.com>",
  });
  const [head, body] = mime.split("\r\n\r\n");

  test("threads the reply with In-Reply-To and References", () => {
    expect(head).toContain("In-Reply-To: <abc@mail.gmail.com>");
    expect(head).toContain("References: <root@mail.gmail.com> <abc@mail.gmail.com>");
  });

  test("encodes a non-ASCII subject and keeps the body as UTF-8", () => {
    expect(head).toContain(`Subject: =?UTF-8?B?${utf8ToBase64("Re: Heizung fällt aus")}?=`);
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(body.replace(/\r\n/g, "")), (c) => c.charCodeAt(0)),
    );
    expect(decoded).toBe("Hallo Felix,\r\nwir schicken morgen einen Techniker.");
  });

  test("a newline in a header value cannot inject another header", () => {
    const evil = buildReplyMime({ from: "a@x.com", to: "b@x.com\r\nBcc: spy@evil.com", subject: "Hi", body: "x" });
    expect(evil).not.toMatch(/\r\nBcc:/);
  });
});

describe("subjects", () => {
  test("adds Re: once", () => {
    expect(replySubject("Leak")).toBe("Re: Leak");
    expect(replySubject("RE: Leak")).toBe("RE: Leak");
  });
  test("ASCII headers stay as they are", () => {
    expect(encodeHeaderValue("Re: Leak")).toBe("Re: Leak");
  });
});
