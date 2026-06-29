export const TARGET = process.env.ABR_TARGET || "https://abrout.com";
export const PORT = parseInt(process.env.PORT || "3000", 10);
export const HOST = process.env.HOST || "0.0.0.0";
export const DEFAULT_BRAND = process.env.DEFAULT_BRAND || "Bet Inja";

// Upstream proxy for Iran-edge where direct abr.out SSL handshake times out.
// Bun's fetch natively supports HTTPS_PROXY, but we also check UPSTREAM_PROXY
// for explicit configuration. When set, it's passed as the `proxy` fetch option.
export const UPSTREAM_PROXY =
  process.env.UPSTREAM_PROXY || process.env.HTTPS_PROXY || "";

const _HBMRaw = process.env.HOST_BRAND_MAP || "";
export const HOST_BRAND_MAP: Record<string, string> = {};
if (_HBMRaw.trim()) {
  try {
    Object.assign(HOST_BRAND_MAP, JSON.parse(_HBMRaw));
  } catch {
    console.error(`Invalid HOST_BRAND_MAP JSON: ${_HBMRaw}`);
  }
}

// Built-in domain→brand defaults (overridable by HOST_BRAND_MAP env)
HOST_BRAND_MAP["betinjabestfriends.com"] ??= "Bet Inja";
HOST_BRAND_MAP["www.betinjabestfriends.com"] ??= "Bet Inja";
HOST_BRAND_MAP["betinj.com"] ??= "BetInj";
HOST_BRAND_MAP["www.betinj.com"] ??= "BetInj";
HOST_BRAND_MAP["nodealer.io"] ??= "NodeAl";
HOST_BRAND_MAP["www.nodealer.io"] ??= "NodeAl";

// Upstream hostname derived from TARGET (used for Host header)
export const UPSTREAM_HOSTNAME = new URL(TARGET).hostname;
