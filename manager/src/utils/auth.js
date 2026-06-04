import { API_BASE_URL } from '../config'

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
  localStorage.removeItem('refreshToken')
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
    // Add a 2-minute buffer to catch tokens about to expire
    if (payload.exp) {
      return (payload.exp * 1000) - Date.now() < 120000
    }

    return false
  } catch (e) {
    // If we can't parse the token, consider it expired
    return true
  }
}

export function syncWithExtension(token, refreshToken) {
  const extensionId = localStorage.getItem('booksmartExtensionId')
  if (!extensionId || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return

  try {
    const email = localStorage.getItem('userEmail')
    const name = localStorage.getItem('userName')
    chrome.runtime.sendMessage(
      extensionId,
      { type: 'BOOKSMART_AUTH_SYNC', token, refreshToken, email, name },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[BookSmart] Extension sync failed from auth.js:', chrome.runtime.lastError.message);
        } else {
          console.log('[BookSmart] Extension sync OK from auth.js:', response);
        }
      }
    )
  } catch (e) {
    console.warn('[BookSmart] sendMessage from auth.js threw:', e)
  }
}

let activeRefreshPromise = null;

/**
 * Refreshes the session using the stored refresh token.
 * Serializes concurrent refresh requests to prevent invalidating single-use tokens.
 */
export async function refreshSession() {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) return null

  if (activeRefreshPromise) {
    return activeRefreshPromise
  }

  activeRefreshPromise = (async () => {
    try {
      console.log('[Auth] Initiating token refresh request...')
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.session?.access_token) {
          const token = data.session.access_token
          localStorage.setItem('authToken', token)
          let newRefreshToken = refreshToken
          if (data.session.refresh_token) {
            newRefreshToken = data.session.refresh_token
            localStorage.setItem('refreshToken', newRefreshToken)
          }
          console.log('[Auth] Token successfully refreshed.')
          // Sync with chrome extension!
          syncWithExtension(token, newRefreshToken)
          return token
        }
      }
      
      console.warn('[Auth] Token refresh request failed on server.')
      return null
    } catch (err) {
      console.error('[Auth] Error executing token refresh:', err)
      return null
    } finally {
      activeRefreshPromise = null
    }
  })()

  return activeRefreshPromise
}

/**
 * Custom fetch wrapper that automatically handles token refresh before sending requests
 */
export async function authenticatedFetch(url, options = {}) {
  let token = localStorage.getItem('authToken')
  const refreshToken = localStorage.getItem('refreshToken')

  if (token && isTokenExpired(token) && refreshToken) {
    console.log('[Auth] Token expired or expiring soon. Refreshing before request...')
    const newToken = await refreshSession()
    if (!newToken) {
      console.warn('[Auth] Pre-request token refresh failed. Logging out.')
      handleAuthError()
      throw new Error('Session expired')
    }
    token = newToken
  }

  // Inject Authorization header
  const headers = {
    ...options.headers
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, {
    ...options,
    headers
  })
}
