// Force IPv4-first DNS resolution for the whole process.
//
// Render has no outbound IPv6 route, and the Supabase pooler hostname can
// resolve to a dual-stack (A + AAAA) DNS record. When a connection attempt
// happens to pick the IPv6 answer, pg fails immediately with ENETUNREACH,
// producing intermittent database errors even while other (IPv4) connections
// succeed. Preferring IPv4 makes every lookup use a route Render can reach.
//
// This module is imported first in index.ts, before any module that opens a
// database connection, so the default is set prior to the first DNS lookup.
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');
