// AES-256-GCM for secrets at rest (Gmail tokens). The key is 32 random bytes,
// base64, in the TOKEN_ENCRYPTION_KEY Convex env var. Output format:
// "v1:" + base64(iv | ciphertext+tag). Uses Web Crypto, so it works in both
// the default and the Node runtime.

const VERSION = "v1:";
const IV_BYTES = 12;

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

async function key() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set on this Convex deployment");
  }
  const bytes = fromBase64(raw);
  if (bytes.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
  }
  return await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(plaintext)),
  );
  const out = new Uint8Array(IV_BYTES + sealed.length);
  out.set(iv);
  out.set(sealed, IV_BYTES);
  return VERSION + toBase64(out);
}

export async function decryptSecret(sealed: string) {
  if (!sealed.startsWith(VERSION)) {
    throw new Error("Unknown secret format");
  }
  const bytes = fromBase64(sealed.slice(VERSION.length));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, IV_BYTES) },
    await key(),
    bytes.slice(IV_BYTES),
  );
  return new TextDecoder().decode(plain);
}
