// Crockford-style alphabet: no 0/O/1/I/L so codes survive being read aloud or retyped.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** WFX-XXXX-XXXX-XXXX (≈ 60 bits of entropy). Uses the platform CSPRNG. */
export function makeVerificationCode(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `WFX-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

export function normaliseCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export const CODE_PATTERN = /^WFX-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/;
