import { CookieOptions } from 'express';

// sameSite: 'none' and partitioned are required because the client and API
// are served from different origins
export const TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  partitioned: true,
};

export const TOKEN_COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // matches JWT_EXPIRES_IN default (12h)
