import { beforeAll, describe, expect, test } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

beforeAll(() => {
  // A fixed test key (32 bytes, base64). Real keys live in Convex env vars.
  process.env.TOKEN_ENCRYPTION_KEY = btoa("0123456789abcdef0123456789abcdef");
});

describe("encryptSecret", () => {
  test("round-trips and never contains the plaintext", async () => {
    const sealed = await encryptSecret("1//refresh-token-value");
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("refresh-token-value");
    expect(await decryptSecret(sealed)).toBe("1//refresh-token-value");
  });

  test("uses a fresh IV, so the same secret encrypts differently", async () => {
    expect(await encryptSecret("same")).not.toBe(await encryptSecret("same"));
  });

  test("rejects tampered ciphertext", async () => {
    const sealed = await encryptSecret("secret");
    const bytes = atob(sealed.slice(3));
    const flipped = bytes.slice(0, -1) + String.fromCharCode(bytes.charCodeAt(bytes.length - 1) ^ 1);
    await expect(decryptSecret(`v1:${btoa(flipped)}`)).rejects.toThrow();
  });
});
