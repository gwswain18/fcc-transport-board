import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { User } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
// HS256 is symmetric; a short secret is brute-forceable offline, allowing
// token forgery for any user. Require at least 32 chars of entropy.
if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters (use a CSPRNG-generated value)');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  csrf?: string; // per-token CSRF value (see middleware/csrf.ts)
  iat?: number; // issued-at, set automatically by jwt.sign
}

export const generateToken = (user: User): string => {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    csrf: randomBytes(16).toString('hex'),
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

// Extract the CSRF value from a freshly-signed token so controllers can return
// it to the client in the response body
export const getTokenCsrf = (token: string): string | undefined => {
  return verifyToken(token).csrf;
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JWTPayload;
};
