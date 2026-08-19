/**
 * Utility functions for device-local time and timezone offset handling.
 */

/**
 * Returns the device's timezone offset string formatted as UTC+X or UTC-X.
 * Examples:
 * - Vietnam (UTC+7): "UTC+7"
 * - Saudi Arabia / Turkey / Moscow (UTC+3): "UTC+3"
 * - London (UTC+0): "UTC+0"
 * - New York (UTC-5): "UTC-5"
 * - India (UTC+5:30): "UTC+5:30"
 * - Nepal (UTC+5:45): "UTC+5:45"
 * - Newfoundland (UTC-3:30): "UTC-3:30"
 */
export const getDeviceTimezoneOffset = (): string => {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }
  const paddedMin = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `UTC${sign}${hours}:${paddedMin}`;
};

/**
 * Formats a given timestamp/date string into local device date & time string.
 */
export const formatLocalDateTime = (
  timeInput: string | number | Date | null | undefined,
  includeSeconds = false
): string => {
  if (!timeInput) return '-';
  let d: Date;
  if (typeof timeInput === 'string') {
    const isUTC = !timeInput.includes('Z') && !timeInput.includes('+');
    d = new Date(isUTC ? timeInput + 'Z' : timeInput);
  } else if (typeof timeInput === 'number') {
    // Check if timestamp is in seconds or milliseconds
    d = new Date(timeInput > 1e11 ? timeInput : timeInput * 1000);
  } else {
    d = timeInput;
  }

  if (isNaN(d.getTime())) return String(timeInput);

  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  });
};
