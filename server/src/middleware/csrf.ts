import { timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';

// Signed double-submit CSRF protection for a cross-origin cookie session.
//
// The auth cookie is sameSite:none, so the browser sends it on cross-site
// requests; CORS blocks reading responses but not triggering requests. Because
// the API and SPA are on different origins, a cookie the API sets is invisible
// to the SPA's document.cookie, so the classic double-submit-cookie pattern
// can't work. Instead the auth JWT carries a random `csrf` claim; the SPA
// receives that value in the login/me response body (which an attacker cannot
// read cross-origin) and echoes it in X-CSRF-Token. The server compares the
// header against the claim inside the httpOnly JWT. An attacker can obtain
// neither the JWT (httpOnly) nor the response body (CORS), so cannot forge it.

const CSRF_HEADER = 'x-csrf-token';

// Unauthenticated, session-establishing endpoints — nothing to protect yet,
// and already guarded by credentials + the CORS preflight their JSON body forces
const EXEMPT_EXACT = new Set([
  '/api/auth/login',
  '/api/auth/oauth',
  '/api/auth/forgot-password',
  '/api/auth/recover-username',
]);
const EXEMPT_PREFIX = ['/api/auth/reset-password'];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

export const validateCsrf = (req: Request, res: Response, next: NextFunction): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  if (EXEMPT_EXACT.has(req.path) || EXEMPT_PREFIX.some((p) => req.path.startsWith(p))) {
    next();
    return;
  }

  // Only enforce for authenticated sessions; unauthenticated mutating requests
  // are rejected downstream by the authenticate middleware.
  const authToken = req.cookies?.token;
  if (!authToken) {
    next();
    return;
  }

  let expected: string | undefined;
  try {
    expected = verifyToken(authToken).csrf;
  } catch {
    // Invalid/expired token — let authenticate produce the 401
    next();
    return;
  }

  const provided = req.get(CSRF_HEADER);
  if (!expected || !provided || !safeEqual(expected, String(provided))) {
    res.status(403).json({ error: 'Invalid or missing CSRF token' });
    return;
  }

  next();
};
