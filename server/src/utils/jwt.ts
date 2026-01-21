import jwt from 'jsonwebtoken';
import { User } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

export const generateToken = (user: User): string => {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};
