// Email Service using nodemailer
// Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM environment variables

import nodemailer from 'nodemailer';
import { query } from '../config/database.js';
import crypto from 'crypto';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

let transporter: nodemailer.Transporter | null = null;

const getConfig = (): EmailConfig | null => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port: parseInt(port, 10),
    user,
    pass,
    from,
  };
};

export const initializeEmail = async (): Promise<boolean> => {
  const config = getConfig();
  if (!config) {
    console.log('Email not configured - email notifications disabled');
    return false;
  }

  try {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    // Verify connection
    await transporter.verify();
    console.log('Email service initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    return false;
  }
};

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  if (!transporter) {
    return { success: false, error: 'Email not configured' };
  }

  const config = getConfig();
  if (!config) {
    return { success: false, error: 'Email configuration missing' };
  }

  try {
    const result = await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const sendPasswordResetEmail = async (
  userId: number
): Promise<{ success: boolean; error?: string }> => {
  // Get user email
  const userResult = await query(
    'SELECT email, first_name FROM users WHERE id = $1',
    [userId]
  );

  if (!userResult.rows[0]) {
    return { success: false, error: 'User not found' };
  }

  const { email, first_name } = userResult.rows[0];

  // Generate reset token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour

  // Store token in database
  await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt.toISOString()]
  );

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;

  const html = `
    <h2>Password Reset Request</h2>
    <p>Hello ${first_name},</p>
    <p>We received a request to reset your FCC Transport Board password.</p>
    <p>Click the link below to reset your password:</p>
    <p><a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request a password reset, please ignore this email.</p>
    <p>- FCC Transport Board Team</p>
  `;

  return sendEmail(email, 'FCC Transport - Password Reset', html);
};

export const sendUsernameRecoveryEmail = async (
  email: string
): Promise<{ success: boolean; error?: string }> => {
  // Get user by email
  const userResult = await query(
    'SELECT email, first_name FROM users WHERE email = $1',
    [email]
  );

  if (!userResult.rows[0]) {
    // Don't reveal if user exists
    return { success: true };
  }

  const { first_name } = userResult.rows[0];

  const html = `
    <h2>Username Recovery</h2>
    <p>Hello ${first_name},</p>
    <p>Your FCC Transport Board username (email) is:</p>
    <p><strong>${email}</strong></p>
    <p>If you did not request this information, please ignore this email.</p>
    <p>- FCC Transport Board Team</p>
  `;

  return sendEmail(email, 'FCC Transport - Username Recovery', html);
};

export const verifyResetToken = async (
  token: string
): Promise<{ valid: boolean; userId?: number; error?: string }> => {
  const result = await query(
    `SELECT user_id, expires_at, used_at FROM password_reset_tokens
     WHERE token = $1`,
    [token]
  );

  if (!result.rows[0]) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  const { user_id, expires_at, used_at } = result.rows[0];

  if (used_at) {
    return { valid: false, error: 'Token has already been used' };
  }

  if (new Date(expires_at) < new Date()) {
    return { valid: false, error: 'Token has expired' };
  }

  return { valid: true, userId: user_id };
};

export const markTokenUsed = async (token: string): Promise<void> => {
  await query(
    `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = $1`,
    [token]
  );
};

export const isEmailConfigured = (): boolean => {
  return transporter !== null;
};
