import { OAuth2Client } from 'google-auth-library';
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import { OAuthProfile } from '../types/index.js';
import logger from './logger.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';

// Google OAuth verification
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export async function verifyGoogleToken(idToken: string): Promise<OAuthProfile> {
  if (!googleClient || !GOOGLE_CLIENT_ID) {
    throw new Error('Google OAuth is not configured');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google token payload');
  }

  return {
    email: payload.email!,
    first_name: payload.given_name || '',
    last_name: payload.family_name || '',
    provider_id: payload.sub,
    provider: 'google',
  };
}

// Microsoft OAuth verification
const msJwksClient = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  rateLimit: true,
});

function getMsSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    msJwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key!.getPublicKey());
    });
  });
}

export async function verifyMicrosoftToken(idToken: string): Promise<OAuthProfile> {
  if (!MICROSOFT_CLIENT_ID) {
    throw new Error('Microsoft OAuth is not configured');
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded) {
    throw new Error('Invalid Microsoft token');
  }

  const signingKey = await getMsSigningKey(decoded.header);

  const payload = jwt.verify(idToken, signingKey, {
    audience: MICROSOFT_CLIENT_ID,
    issuer: [
      `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/v2.0`,
      'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0',
    ],
  }) as Record<string, string>;

  return {
    email: payload.preferred_username || payload.email,
    first_name: payload.given_name || '',
    last_name: payload.family_name || '',
    provider_id: payload.oid || payload.sub,
    provider: 'microsoft',
  };
}

export async function verifyOAuthToken(provider: string, idToken: string): Promise<OAuthProfile> {
  switch (provider) {
    case 'google':
      return verifyGoogleToken(idToken);
    case 'microsoft':
      return verifyMicrosoftToken(idToken);
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}
