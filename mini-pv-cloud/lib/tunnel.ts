/** Base URL for Cloudflare tunnel → Pi Node-RED (no trailing slash). */
export function tunnelBase(): string | null {
  const raw = process.env.COMMAND_TUNNEL_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}
