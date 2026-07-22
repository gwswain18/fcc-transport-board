import { Request, Response } from 'express';
import { query } from '../config/database.js';
import { generateToken, getTokenCsrf } from '../utils/jwt.js';
import { verifyOAuthToken } from '../utils/oauth.js';
import { getAuthProviderFlags } from '../services/configService.js';
import { logLogin } from '../services/auditService.js';
import { getAuditContext } from '../middleware/auditMiddleware.js';
import { AuthenticatedRequest } from '../types/index.js';
import { TOKEN_COOKIE_OPTIONS, TOKEN_COOKIE_MAX_AGE_MS } from '../utils/cookies.js';
import logger from '../utils/logger.js';

// Which third-party sign-in providers are currently enabled. Public — the
// login page needs it before authentication to decide which buttons to show.
export const getAuthProviders = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await getAuthProviderFlags());
  } catch (error) {
    logger.error('Get auth providers error:', error);
    res.status(500).json({ error: 'Failed to get auth providers' });
  }
};

export const oauthLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider, id_token } = req.body;

    if (!provider || !id_token) {
      res.status(400).json({ error: 'Provider and id_token are required' });
      return;
    }

    if (!['google', 'microsoft'].includes(provider)) {
      res.status(400).json({ error: 'Invalid OAuth provider' });
      return;
    }

    // Manager toggle — the buttons are hidden client-side, but the endpoint
    // must reject too or the cutoff is cosmetic
    const providerFlags = await getAuthProviderFlags();
    if (!providerFlags[provider as 'google' | 'microsoft']) {
      res.status(403).json({ error: 'Sign-in with this provider is currently disabled' });
      return;
    }

    // Verify the token with the provider
    const profile = await verifyOAuthToken(provider, id_token);

    // 1. Look up by provider + provider_id
    let result = await query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active,
              primary_floor, phone_number, include_in_analytics, is_temp_account,
              auth_provider, provider_id, approval_status,
              created_at, updated_at
       FROM users WHERE auth_provider = $1 AND provider_id = $2`,
      [provider, profile.provider_id]
    );

    let user = result.rows[0];

    // 2. If not found, look up by email — but only when the provider certifies
    // the email, otherwise an attacker-controlled claim could take over an
    // existing account
    if (!user) {
      if (profile.email_verified) {
        result = await query(
          `SELECT id, email, password_hash, first_name, last_name, role, is_active,
                  primary_floor, phone_number, include_in_analytics, is_temp_account,
                  auth_provider, provider_id, approval_status,
                  created_at, updated_at
           FROM users WHERE email = $1`,
          [profile.email.toLowerCase()]
        );

        user = result.rows[0];

        if (user) {
          // Block OAuth login for temp accounts
          if (user.is_temp_account) {
            res.status(403).json({ error: 'Temp accounts cannot use OAuth sign-in' });
            return;
          }

          // Existing local user — auto-link OAuth account
          if (user.auth_provider === 'local' && !user.provider_id) {
            await query(
              `UPDATE users SET auth_provider = $1, provider_id = $2 WHERE id = $3`,
              [provider, profile.provider_id, user.id]
            );
            user.auth_provider = provider;
            user.provider_id = profile.provider_id;
          }
          // If they already have a different OAuth provider linked, don't overwrite
        }
      } else {
        // Unverified email: never link; reject if the email is already taken
        const existingEmail = await query('SELECT id FROM users WHERE email = $1', [
          profile.email.toLowerCase(),
        ]);
        if (existingEmail.rows.length > 0) {
          res.status(403).json({
            error:
              'An account with this email already exists. Sign in with your password, then link this provider from your profile.',
          });
          return;
        }
      }
    }

    // 3. If no user at all, create a new pending user
    if (!user) {
      result = await query(
        `INSERT INTO users (email, first_name, last_name, role, auth_provider, provider_id, approval_status)
         VALUES ($1, $2, $3, 'transporter', $4, $5, 'pending')
         RETURNING id, email, first_name, last_name, role, is_active,
                   primary_floor, phone_number, include_in_analytics, is_temp_account,
                   auth_provider, provider_id, approval_status,
                   created_at, updated_at`,
        [profile.email.toLowerCase(), profile.first_name, profile.last_name, provider, profile.provider_id]
      );
      user = result.rows[0];
    }

    if (!user.is_active) {
      res.status(401).json({ error: 'Account is deactivated' });
      return;
    }

    // Generate JWT and set cookie
    const token = generateToken(user);

    const { ipAddress, userAgent } = getAuditContext(req as AuthenticatedRequest);
    await logLogin(user.id, ipAddress, userAgent);

    res.cookie('token', token, { ...TOKEN_COOKIE_OPTIONS, maxAge: TOKEN_COOKIE_MAX_AGE_MS });

    const { password_hash: _, ...safeUser } = user;

    // Check active shift for transporters
    let activeShift = null;
    if (user.role === 'transporter' && user.approval_status === 'approved') {
      const shiftResult = await query(
        'SELECT * FROM shift_logs WHERE user_id = $1 AND shift_end IS NULL',
        [user.id]
      );
      activeShift = shiftResult.rows[0] || null;
    }

    res.json({
      user: safeUser,
      activeShift,
      csrfToken: getTokenCsrf(token),
      isPending: user.approval_status === 'pending',
      message: user.approval_status === 'pending' ? 'Account pending approval' : 'Login successful',
    });
  } catch (error) {
    logger.error('OAuth login error:', error);
    res.status(401).json({ error: 'OAuth authentication failed' });
  }
};
