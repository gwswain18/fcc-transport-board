import { Floor, FloorRoomValidation } from '../types/index.js';

// Map floor to expected first digit of room number
const FLOOR_DIGIT_MAP: Record<Floor, string> = {
  FCC1: '1',
  FCC4: '4',
  FCC5: '5',
  FCC6: '6',
};

// Validate that a room number is valid for a given floor
// New logic: First digit of room must match floor number
export const validateFloorRoom = (
  floor: Floor,
  roomNumber: string
): FloorRoomValidation => {
  // Extract numeric part of room number (handles formats like "401", "401A", "401-B")
  const numericMatch = roomNumber.match(/^(\d+)/);

  if (!numericMatch) {
    return {
      floor,
      room_number: roomNumber,
      is_valid: false,
      error: 'Room number must start with a number',
    };
  }

  const expectedFirstDigit = FLOOR_DIGIT_MAP[floor];

  if (!expectedFirstDigit) {
    return {
      floor,
      room_number: roomNumber,
      is_valid: false,
      error: `Unknown floor: ${floor}`,
    };
  }

  const firstDigit = numericMatch[1][0];

  if (firstDigit !== expectedFirstDigit) {
    return {
      floor,
      room_number: roomNumber,
      is_valid: false,
      error: `Room ${roomNumber} should start with ${expectedFirstDigit} for ${floor}`,
    };
  }

  return {
    floor,
    room_number: roomNumber,
    is_valid: true,
  };
};

// Validate room number format
export const isValidRoomFormat = (roomNumber: string): boolean => {
  // Accepts formats like: 401, 401A, 401-B, 401/2
  return /^\d{3}[A-Za-z0-9\-\/]*$/.test(roomNumber);
};

// Get the expected floor for a room number based on first digit
export const getExpectedFloor = (roomNumber: string): Floor | null => {
  const numericMatch = roomNumber.match(/^(\d+)/);
  if (!numericMatch) return null;

  const firstDigit = numericMatch[1][0];

  for (const [floor, digit] of Object.entries(FLOOR_DIGIT_MAP)) {
    if (digit === firstDigit) {
      return floor as Floor;
    }
  }

  return null;
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number format (flexible for international)
export const isValidPhoneNumber = (phone: string): boolean => {
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, '');
  // Check if it's all digits and reasonable length
  return /^\d{10,15}$/.test(cleaned);
};

// Validate password strength
export const validatePasswordStrength = (
  password: string
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Validate extension format
export const isValidExtension = (extension: string): boolean => {
  // Extension should be 3-6 digits
  return /^\d{3,6}$/.test(extension);
};

// Sanitize string input (prevent XSS)
export const sanitizeString = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};
