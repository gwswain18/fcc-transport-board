import { Floor, FLOOR_ROOM_RANGES, FloorRoomValidation } from '../types/index.js';

// Validate that a room number is valid for a given floor
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

  const roomNum = parseInt(numericMatch[1], 10);
  const range = FLOOR_ROOM_RANGES[floor];

  if (!range) {
    return {
      floor,
      room_number: roomNumber,
      is_valid: false,
      error: `Unknown floor: ${floor}`,
    };
  }

  if (roomNum < range.min || roomNum > range.max) {
    return {
      floor,
      room_number: roomNumber,
      is_valid: false,
      error: `Room ${roomNumber} is not valid for ${floor}. Valid range: ${range.min}-${range.max}`,
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

// Get the expected floor for a room number
export const getExpectedFloor = (roomNumber: string): Floor | null => {
  const numericMatch = roomNumber.match(/^(\d+)/);
  if (!numericMatch) return null;

  const roomNum = parseInt(numericMatch[1], 10);

  for (const [floor, range] of Object.entries(FLOOR_ROOM_RANGES)) {
    if (roomNum >= range.min && roomNum <= range.max) {
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
