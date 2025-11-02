/**
 * Custom Error Classes
 */

export class QuotaExceededError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'QuotaExceededError';
    this.isQuotaError = true;
    this.originalError = originalError;
  }
}

export function isQuotaError(error) {
  // Check if it's our custom QuotaExceededError
  if (error?.isQuotaError) {
    return true;
  }

  // Check error message for quota-related keywords
  const errorMessage = (error?.message || '').toLowerCase();
  const quotaKeywords = [
    'quota exceeded',
    'too many requests',
    'rate limit',
    '429',
    'resource exhausted'
  ];

  return quotaKeywords.some(keyword => errorMessage.includes(keyword));
}
