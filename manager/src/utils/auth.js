/**
 * Authentication utilities
 */

/**
 * Check if an error response indicates an expired/invalid token
 */
export function isAuthError(error) {
  if (!error) return false

  const message = error.message?.toLowerCase() || ''
  const isTokenError =
    message.includes('invalid') ||
    message.includes('expired') ||
    message.includes('token') ||
    message.includes('unauthorized') ||
    message.includes('401')

  return isTokenError
}

/**
 * Handle authentication errors by logging out user
 */
export function handleAuthError() {
  // Clear all auth data
  localStorage.removeItem('authToken')
  localStorage.removeItem('userEmail')
  localStorage.removeItem('userName')

  // Reload page to trigger redirect to login
  window.location.href = '/'
}

/**
 * Check if JWT token is expired (client-side check)
 */
export function isTokenExpired(token) {
  if (!token) return true

  try {
    // Decode JWT payload
    const payload = JSON.parse(atob(token.split('.')[1]))

    // Check expiration (exp is in seconds, Date.now() is in milliseconds)
    if (payload.exp) {
      return payload.exp * 1000 < Date.now()
    }

    return false
  } catch (e) {
    // If we can't parse the token, consider it expired
    return true
  }
}
