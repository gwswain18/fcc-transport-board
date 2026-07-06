import dotenv from 'dotenv';

// Idempotent; guarantees env is loaded even if this module is imported
// before index.ts calls dotenv.config()
dotenv.config();

// CLIENT_URL may be a comma-separated list of allowed origins, e.g.
// "https://fcctransport.com,https://fcc-transport-client.onrender.com".
// The first entry is the primary client URL used when building links.
export const allowedOrigins: string[] = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const primaryClientUrl: string = allowedOrigins[0];
