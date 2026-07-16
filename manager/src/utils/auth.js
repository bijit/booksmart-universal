import { API_BASE_URL } from '../config'

/**
 * Check if an error is a definitive authentication failure.
 * Uses an explicit __isAuthError marker set by authenticatedFetch to avoid false
 * positives from non-auth errors that happen to contain words like 'invalid' or 'token'.
 */
export function isAuthError(error) {
  if (!error) return false
  // Only trust our own explicit marker — never do broad string matching
  return error.__isAuthError === true
}

/**
 * Handle authentication errors by logging out user
 */
export function handleAuthError() {
  localStorage.removeItem('authToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('userEmail')
  localStorage.removeItem('userName')
  window.location.href = '/'
}

/**
 * Check if JWT token is within 2 minutes of expiry (proactive refresh window)
 */
export function isTokenExpired(token) {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp) {
      return (payload.exp * 1000) - Date.now() < 120000
    }
    return false
  } catch (e) {
    return true
  }
}

/**
 * Returns true only if the token is past its actual expiry (no buffer)
 */
function isTokenTrulyExpired(token) {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 < Date.now() : true
  } catch (e) {
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
          console.warn('[BookSmart] Extension sync failed from auth.js:', chrome.runtime.lastError.message)
        } else {
          console.log('[BookSmart] Extension sync OK from auth.js:', response)
        }
      }
    )
  } catch (e) {
    console.warn('[BookSmart] sendMessage from auth.js threw:', e)
  }
}

let activeRefreshPromise = null

export async function refreshSession() {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) return null

  if (activeRefreshPromise) {
    return activeRefreshPromise
  }

  // Cross-tab lock: avoid duplicate refresh across tabs (lock active for max 10 seconds)
  const refreshLock = localStorage.getItem('authRefreshLock')
  if (refreshLock && Date.now() - parseInt(refreshLock, 10) < 10000) {
    console.log('[Auth] Another tab is refreshing. Waiting...')
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const token = localStorage.getItem('authToken')
      if (token && !isTokenExpired(token)) {
        console.log('[Auth] Fresh token detected from another tab.')
        return token
      }
    }
  }

  localStorage.setItem('authRefreshLock', Date.now().toString())

  activeRefreshPromise = (async () => {
    try {
      console.log('[Auth] Initiating token refresh...')
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          console.log('[Auth] Token refreshed successfully.')
          syncWithExtension(token, newRefreshToken)
          return token
        }
      }

      console.warn('[Auth] Token refresh failed on server.')
      return null
    } catch (err) {
      console.error('[Auth] Error during token refresh:', err)
      return null
    } finally {
      activeRefreshPromise = null
      localStorage.removeItem('authRefreshLock')
    }
  })()

  return activeRefreshPromise
}

/**
 * Custom fetch wrapper with automatic token refresh.
 *
 * Strategy:
 *  1. If token is within 2-min expiry buffer → try proactive refresh.
 *     - If refresh succeeds → use new token.
 *     - If refresh fails but token is NOT truly expired → proceed with existing
 *       token (handles Cloud Run cold starts / transient network blips).
 *     - If refresh fails AND token is truly expired → log out.
 *  2. If server responds with 401 → refresh + auto-retry the request once.
 *     - If still 401 after retry → log out.
 *  3. isAuthError() ONLY checks the explicit __isAuthError marker, never broad
 *     string matching — eliminates false-positive logouts from messages like
 *     "Invalid folder name" or "URL token expired".
 */
export async function authenticatedFetch(url, options = {}) {
  let token = localStorage.getItem('authToken')
  const refreshToken = localStorage.getItem('refreshToken')

  // Pre-request proactive refresh
  if (token && isTokenExpired(token) && refreshToken) {
    console.log('[Auth] Token expiring soon. Refreshing before request...')
    const newToken = await refreshSession()
    if (newToken) {
      token = newToken
    } else if (isTokenTrulyExpired(token)) {
      // Token is genuinely dead and refresh failed — must log out
      console.warn('[Auth] Token truly expired and refresh failed. Logging out.')
      const authError = new Error('Session expired. Please log in again.')
      authError.__isAuthError = true
      handleAuthError()
      throw authError
    } else {
      // Token is in the 2-min buffer but still technically valid — proceed
      console.warn('[Auth] Refresh failed but token still valid. Proceeding with existing token.')
    }
  }

  const headers = { ...options.headers }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response = await fetch(url, { ...options, headers })

  // On 401: refresh + retry once before giving up
  if (response.status === 401 && refreshToken) {
    console.log('[Auth] 401 received. Refreshing token and retrying...')
    const newToken = await refreshSession()
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`
      response = await fetch(url, { ...options, headers })
    }

    if (response.status === 401) {
      console.warn('[Auth] Still 401 after refresh + retry. Logging out.')
      const authError = new Error('Session expired. Please log in again.')
      authError.__isAuthError = true
      handleAuthError()
      throw authError
    }
  }

  return response
}
