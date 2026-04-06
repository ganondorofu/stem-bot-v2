// Input validation utilities

// Discord snowflake IDs are numeric strings of 17-20 digits
const SNOWFLAKE_REGEX = /^\d{17,20}$/;

/**
 * Validate a Discord snowflake ID (user ID, role ID, etc.)
 */
export const isValidSnowflake = (value: string): boolean => {
  return SNOWFLAKE_REGEX.test(value);
};

/**
 * Validate a generation number (positive integer)
 */
export const isValidGeneration = (value: number): boolean => {
  return Number.isInteger(value) && value > 0 && value < 1000;
};

/**
 * Validate a nickname name part (non-empty, reasonable length, no control chars)
 * Discord nickname limit is 32 characters total; name is only a portion.
 */
export const isValidName = (value: string): boolean => {
  if (!value || typeof value !== 'string') return false;
  // Strip zero-width and control characters for validation
  // eslint-disable-next-line no-control-regex
  const hasControlChars = /[\x00-\x1F\x7F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/.test(value);
  if (hasControlChars) return false;
  // Reasonable length: 1-20 chars to leave room for suffix like "(学籍番号)"
  if (value.length < 1 || value.length > 20) return false;
  return true;
};
