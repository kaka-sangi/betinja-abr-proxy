# abr-proxy

TypeScript port of `abr-proxy.py` — an outbound reverse proxy for ABR
subscription reselling, running on Bun + Hono.

## Quick start

```bash
bun install
bun run src/index.ts
```

## Environment

| Variable         | Default            | Description                                      |
|------------------|--------------------|--------------------------------------------------|
| `ABR_TARGET`     | `https://abrout.com` | Upstream base URL                               |
| `PORT`           | `3000`             | Listen port                                       |
| `HOST`           | `0.0.0.0`         | Listen address                                    |
| `DEFAULT_BRAND`  | `BetInj`           | Fallback subscription brand                       |
| `HOST_BRAND_MAP` | `""`               | JSON dict `{"hostname":"brand"}` merging over defaults |
| `UPSTREAM_PROXY` | `""`               | HTTP proxy URL for upstream connections (see below) |

Built-in brand mapping: `betinj.com` → BetInj, `nodealer.io` → NodeAl
(overridable via `HOST_BRAND_MAP`).

## Connectivity

### Iran-edge VPS: SSL timeout to abrout.com

VPS instances in Iran (or other restricted networks) often cannot complete a
direct TLS handshake to `abrout.com` — the SSL connection hangs or times out
because traffic to the server's IP range is throttled or blocked.

**Workaround:** run a local HTTP proxy (e.g. a WireGuard-connected VPS outside
the restricted zone) and route upstream traffic through it:

```bash
# Using an HTTP proxy on 127.0.0.1:8080
UPSTREAM_PROXY=http://127.0.0.1:8080 bun run src/index.ts

# Or set the standard env var (also respected by Bun's fetch):
HTTPS_PROXY=http://127.0.0.1:8080 bun run src/index.ts
```

The proxy value is passed to Bun's native `fetch` `proxy` option, which
establishes a `CONNECT` tunnel to the upstream TLS endpoint.  This works with
any HTTP(S) forward proxy — Squid, Tinyproxy, mitmproxy, or a SOCKS-to-HTTP
bridge.

### TLS verification

The proxy sets `rejectUnauthorized: false` on upstream TLS connections because
the VPS may lack up-to-date CA certificates.  Do not use this in
production-facing deployments without additional transport security.

## Routes

- `GET /` — healthcheck, returns `OK`
- `GET /health` — healthcheck, returns `OK`
- `/*` — reverse proxy to `ABR_TARGET` (any method)
  - `/sub/*` responses are base64-decoded, branded per-domain, and
    re-encoded before forwarding to the client.
