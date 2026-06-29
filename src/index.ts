import { HOST, PORT, TARGET, UPSTREAM_PROXY } from "./config";
import app from "./proxy";

const tag = process.env.ABR_TARGET || "https://abrout.com";
const proxyNote = UPSTREAM_PROXY ? ` (via ${UPSTREAM_PROXY})` : "";

console.log(`🔄 Abr Outbound reverse proxy → ${tag}${proxyNote}`);
console.log(`📍 Listening on http://${HOST}:${PORT}`);

Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch: app.fetch,
});
