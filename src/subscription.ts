import { HOST_BRAND_MAP, DEFAULT_BRAND } from "./config";

export function resolveBrand(host: string): string {
  return HOST_BRAND_MAP[host] ?? DEFAULT_BRAND;
}

/**
 * Safe URL-decode — mirrors Python's urllib.parse.unquote which passes
 * through malformed % sequences instead of throwing.
 */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/%(?![0-9a-fA-F]{2})/g, "%25"));
  } catch {
    return s;
  }
}

/**
 * Transform base64 subscription data: ensure every config line has a branded
 * #name suffix.  Returns rewritten base64 bytes, or null if data is not a
 * valid subscription (passes through unchanged).
 *
 * Mirrors abr-proxy.py _transform_subscription exactly:
 *  1. Decode base64
 *  2. Validate every non-empty line looks like a proxy URL
 *  3. For each line, partition on first "#":
 *      - No "#" → append "#<brand>"
 *      - Has "#" → URL-decode name, replace "BetInja" → brand, re-encode
 *  4. Re-encode as base64
 */
export function transformSubscription(
  data: Uint8Array,
  brand: string,
): Uint8Array | null {
  // Convert bytes to base64 string
  const b64Str = new TextDecoder("utf-8", { fatal: false }).decode(data);
  if (!b64Str) return null;

  // Decode base64 to get the subscription plaintext
  let text: string;
  try {
    text = Buffer.from(b64Str, "base64").toString("utf-8");
  } catch {
    return null;
  }

  const lines = text.split("\n");
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return null;

  // Verify every non-empty line starts with a protocol (proxy URL)
  const proxyRe = /^[a-z]+:\/\//;
  if (!nonEmpty.every((l) => proxyRe.test(l.trim()))) return null;

  const transformed: string[] = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) {
      transformed.push("");
      continue;
    }

    const hashIdx = stripped.indexOf("#");
    if (hashIdx === -1) {
      // No name fragment — inject brand
      transformed.push(`${stripped}#${brand}`);
    } else {
      const basePart = stripped.substring(0, hashIdx);
      const rawName = stripped.substring(hashIdx + 1);
      let name = safeDecode(rawName);
      // Replace the generic placeholder with the actual brand
      name = name.replace(/BetInja/g, brand);
      if (!name.trim()) name = brand;
      transformed.push(`${basePart}#${encodeURIComponent(name)}`);
    }
  }

  // Re-encode as base64 → Uint8Array
  const newB64 = Buffer.from(transformed.join("\n"), "utf-8").toString(
    "base64",
  );
  return new TextEncoder().encode(newB64);
}
