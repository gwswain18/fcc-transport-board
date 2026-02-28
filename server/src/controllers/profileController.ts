import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { isValidEmail, isValidPhoneNumber } from '../utils/validation.js';
import { verifyOAuthToken } from '../utils/oauth.js';
import logger from '../utils/logger.js';

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active,
              primary_floor, phone_number, include_in_analytics, is_temp_account,
              auth_provider, provider_id, approval_status,
              created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { first_name, last_name, phone_number, email } = req.body;

    // Get current user data
    const current = await query(
      'SELECT auth_provider, email FROM users WHERE id = $1',
      [req.user.id]
    );
    const currentUser = current.rows[0];

    // Only local users can change email
    if (email && email.toLowerCase() !== currentUser.email && currentUser.auth_provider !== 'local') {
      res.status(400).json({ error: 'OAuth users cannot change their email address' });
      return;
    }

    // Validate email if being changed
    if (email && email.toLowerCase() !== currentUser.email) {
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase(), req.user.id]
      );
      if (emailCheck.rows.length > 0) {
        res.status(409).json({ error: 'Email already exists' });
        return;
      }
    }

    // Validate phone number if provided
    if (phone_number && !isValidPhoneNumber(phone_number)) {
      res.status(400).json({ error: 'Invalid phone number format' });
      return;
    }

    const result = await query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone_number = COALESCE($3, phone_number),
           email = COALESCE($4, email),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, email, first_name, last_name, role, is_active,
                 primary_floor, phone_number, include_in_analytics, is_temp_account,
                 auth_provider, provider_id, approval_status,
                 created_at, updated_at`,
      [first_name, last_name, phone_number || null, email?.toLowerCase(), req.user.id]
    );

    res.json({ user: result.rows[0], message: 'Profile updated successfully' });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const linkOAuthAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { provider, id_token } = req.body;

    if (!provider || !id_token) {
      res.status(400).json({ error: 'Provider and id_token are required' });
      return;
    }

    // Verify current user is a local user
    const current = await query(
      'SELECT auth_provider, provider_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (current.rows[0].provider_id) {
      res.status(400).json({ error: 'Account already has an OAuth provider linked' });
      return;
    }

    // Verify the OAuth token
    const profile = await verifyOAuthToken(provider, id_token);

    // Check if this OAuth identity is already linked to another account
    const existing = await query(
      'SELECT id FROM users WHERE auth_provider = $1 AND provider_id = $2',
      [provider, profile.provider_id]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'This OAuth account is already linked to another user' });
      return;
    }

    await query(
      `UPDATE users SET auth_provider = $1, provider_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [provider, profile.provider_id, req.user.id]
    );

    res.json({ message: `${provider} account linked successfully` });
  } catch (error) {
    logger.error('Link OAuth error:', error);
    res.status(500).json({ error: 'Failed to link OAuth account' });
  }
};
