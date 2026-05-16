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

  // Only treat as a pause-worthy quota error if it's from our AI services
  const isAIServiceError = errorMessage.includes('google') || 
                           errorMessage.includes('gemini') || 
                           errorMessage.includes('embedding') ||
                           errorMessage.includes('ai');

  if (!isAIServiceError) return false;

  const quotaKeywords = [
    'quota exceeded',
    'too many requests',
    'rate limit',
    '429',
    'resource exhausted'
  ];

  return quotaKeywords.some(keyword => errorMessage.includes(keyword));
}

/**
 * Retry a function with exponential backoff
 * 
 * @param {Function} fn - The async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.initialDelay - Initial delay in ms
 * @returns {Promise<any>} Result of the function
 */
export async function withRetry(fn, { maxRetries = 3, initialDelay = 1000 } = {}) {
  let lastError;
  let delay = initialDelay;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's not a quota error or if we're at max retries
      if (!isQuotaError(error) || i === maxRetries) {
        throw error;
      }

      console.warn(`[Retry] Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff
      delay *= 2;
    }
  }

  throw lastError;
}
