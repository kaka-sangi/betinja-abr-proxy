import { Hono } from "hono";
import {
  TARGET,
  UPSTREAM_PROXY,
  UPSTREAM_HOSTNAME,
} from "./config";
import { resolveBrand, transformSubscription } from "./subscription";

const app = new Hono();

// ---------------------------------------------------------------------------
// Healthcheck
// ---------------------------------------------------------------------------
app.get("/", (c) => c.text("OK"));
app.get("/health", (c) => c.text("OK"));

// ---------------------------------------------------------------------------
// Reverse proxy — every method, every path
// ---------------------------------------------------------------------------
const HOP_BY_HOP_REQ = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
]);
const HOP_BY_HOP_RES = new Set([
  "transfer-encoding",
  "connection",
  "keep-alive",
]);
const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

app.all("/*", async (c) => {
  const incomingUrl = new URL(c.req.raw.url);
  const pathAndQuery = incomingUrl.pathname + incomingUrl.search;
  const targetUrl = TARGET + pathAndQuery;

  // Forward headers (skip hop-by-hop); set upstream Host
  const headers = new Headers(c.req.raw.headers);
  for (const h of HOP_BY_HOP_REQ) headers.delete(h);
  headers.set("Host", UPSTREAM_HOSTNAME);
  if (incomingUrl.pathname.startsWith("/sub/")) {
    headers.set("Accept-Encoding", "identity");
  }

  const fetchOpts: Record<string, unknown> = {
    method: c.req.method,
    headers,
    // Upstream TLS may have expired / self-signed certs (cheap VPS)
    tls: { rejectUnauthorized: false },
  };

  // Explicit upstream proxy — Iran-edge SSL handshake workaround
  if (UPSTREAM_PROXY) {
    fetchOpts.proxy = UPSTREAM_PROXY;
  }

  if (!NO_BODY_METHODS.has(c.req.method)) {
    fetchOpts.body = c.req.raw.body;
  }

  // 60 s upstream timeout matching Python original
  const controller = new AbortController();
  fetchOpts.signal = controller.signal;
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const resp = await fetch(targetUrl, fetchOpts as RequestInit);

    // Strip hop-by-hop from response headers
    const respHeaders = new Headers(resp.headers);
    for (const h of HOP_BY_HOP_RES) respHeaders.delete(h);

    // /sub/ paths need body buffering for base64 brand transformation
    if (incomingUrl.pathname.startsWith("/sub/")) {
      let body: ArrayBuffer = await resp.arrayBuffer();
      respHeaders.delete("content-length");
      respHeaders.delete("content-encoding");
      const host = c.req.header("host") || "";
      const brand = resolveBrand(host.split(":")[0]);
      const transformed = transformSubscription(new Uint8Array(body), brand);
      if (transformed !== null) {
        body = (transformed.buffer as ArrayBuffer).slice(
          transformed.byteOffset,
          transformed.byteOffset + transformed.byteLength,
        );
      }
      respHeaders.delete("content-encoding");
      respHeaders.set("content-length", String(body.byteLength));
      return new Response(body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      });
    }

    // All other paths: stream directly, no buffering
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Proxy error ${pathAndQuery}: ${msg}`);
    return new Response("Bad Gateway", { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
});

export default app;
