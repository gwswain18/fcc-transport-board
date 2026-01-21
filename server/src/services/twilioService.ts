// Twilio SMS Service
// Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables

import { query } from '../config/database.js';
import logger from '../utils/logger.js';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

let twilioClient: {
  messages: {
    create: (params: { body: string; to: string; from: string }) => Promise<{ sid: string }>;
  };
} | null = null;

const getConfig = (): TwilioConfig | null => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return null;
  }

  return { accountSid, authToken, fromNumber };
};

export const initializeTwilio = async (): Promise<boolean> => {
  const config = getConfig();
  if (!config) {
    logger.info('Twilio not configured - SMS notifications disabled');
    return false;
  }

  try {
    // Dynamic import to avoid requiring twilio if not configured
    const twilio = await import('twilio');
    twilioClient = twilio.default(config.accountSid, config.authToken);
    logger.info('Twilio SMS service initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Twilio:', error);
    return false;
  }
};

export const sendSMS = async (
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  if (!twilioClient) {
    return { success: false, error: 'Twilio not configured' };
  }

  const config = getConfig();
  if (!config) {
    return { success: false, error: 'Twilio configuration missing' };
  }

  try {
    // Format phone number (add +1 if not present for US numbers)
    let formattedTo = to.replace(/[\s\-\(\)\.]/g, '');
    if (!formattedTo.startsWith('+')) {
      formattedTo = '+1' + formattedTo;
    }

    const result = await twilioClient.messages.create({
      body: message,
      to: formattedTo,
      from: config.fromNumber,
    });

    return { success: true, messageId: result.sid };
  } catch (error) {
    logger.error('SMS send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const sendJobAssignmentSMS = async (
  userId: number,
  requestId: number,
  originFloor: string,
  roomNumber: string,
  priority: string
): Promise<boolean> => {
  // Get user phone number
  const userResult = await query(
    'SELECT phone_number, first_name FROM users WHERE id = $1',
    [userId]
  );

  if (!userResult.rows[0]?.phone_number) {
    return false;
  }

  const priorityText = priority === 'stat' ? 'STAT ' : '';
  const message = `FCC Transport: ${priorityText}Job assigned - ${originFloor} Room ${roomNumber}. Please accept in the app.`;

  const result = await sendSMS(userResult.rows[0].phone_number, message);
  return result.success;
};

export const sendBreakAlertSMS = async (
  userId: number,
  minutesOnBreak: number
): Promise<boolean> => {
  // Get user phone number
  const userResult = await query(
    'SELECT phone_number, first_name FROM users WHERE id = $1',
    [userId]
  );

  if (!userResult.rows[0]?.phone_number) {
    return false;
  }

  const message = `FCC Transport: You have been on break for ${minutesOnBreak} minutes. Please return to available status or contact dispatch.`;

  const result = await sendSMS(userResult.rows[0].phone_number, message);
  return result.success;
};

export const isTwilioConfigured = (): boolean => {
  return twilioClient !== null;
};
