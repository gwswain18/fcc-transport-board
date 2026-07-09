// Force IPv4 for all outbound connections in this process.
//
// Render has no outbound IPv6 route, and the Supabase pooler hostname resolves
// to a dual-stack (A + AAAA) DNS record. Any connection attempt that reaches
// the IPv6 address dies immediately with ENETUNREACH — which surfaces as the
// DB being unreachable and the /health check failing (502 at the proxy).
//
// Two settings are needed:
//   1. setDefaultResultOrder('ipv4first') — order DNS results IPv4-first.
//   2. setDefaultAutoSelectFamily(false)  — Node 18.13+/20+ enables "Happy
//      Eyeballs", which races IPv4 and IPv6 connections in parallel and can
//      still attempt (and fail on) the IPv6 address despite the ordering above.
//      Disabling it makes connections use the single IPv4-first address only.
//
// Both are process-global and safe for every outbound host (Supabase, Gmail
// SMTP, Twilio, Google OAuth are all reachable over IPv4). This module is
// imported first in index.ts, before any module opens a database connection.
import dns from 'node:dns';
import net from 'node:net';

dns.setDefaultResultOrder('ipv4first');

// Guard for older Node versions that lack the API.
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}
