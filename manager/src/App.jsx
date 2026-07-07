import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import { refreshSession } from './utils/auth'

// ── Extension auth bridge ─────────────────────────────────────────────────────
// Retrieve the BookSmart extension ID dynamically from localStorage
const getExtensionId = () => localStorage.getItem('booksmartExtensionId') || '';

/**
 * Pushes auth tokens directly into the extension via chrome.runtime.sendMessage.
 * Requires externally_connectable in the manifest (already configured).
 */
function sendTokensToExtension(token, refreshToken, email, name) {
  const extensionId = getExtensionId();
  if (!extensionId) {
    console.warn('[BookSmart] Extension ID not set – skipping push sync. Set it with: localStorage.setItem("booksmartExtensionId", "YOUR_ID")');
    return;
  }
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  try {
    chrome.runtime.sendMessage(
      extensionId,
      { type: 'BOOKSMART_AUTH_SYNC', token, refreshToken, email, name },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[BookSmart] Extension push sync failed:', chrome.runtime.lastError.message);
        } else {
          console.log('[BookSmart] Extension push sync OK:', response);
        }
      }
    );
  } catch (e) {
    console.warn('[BookSmart] sendMessage threw:', e);
  }
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('darkMode')
    if (saved !== null) {
      return JSON.parse(saved)
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // 1. Check for token in location hash first (from Google OAuth Redirect)
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken) {
        localStorage.setItem('authToken', accessToken)
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken)
        }

        // Parse user details
        let oauthEmail = null, oauthName = null;
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]))
          if (payload.email) {
            oauthEmail = payload.email;
            oauthName = payload.user_metadata?.name || payload.email.split('@')[0];
            localStorage.setItem('userEmail', oauthEmail)
            localStorage.setItem('userName', oauthName)
          }
        } catch (e) {
          console.error('Failed to parse OAuth session payload:', e)
        }

        // Push tokens directly into the extension (primary auth sync path)
        sendTokensToExtension(accessToken, refreshToken, oauthEmail, oauthName);

        // Clean url fragment
        window.history.replaceState({}, document.title, window.location.pathname)
        return true
      }
    }

    // 2. Check for token in URL query search params (from extension SSO)
    const urlParams = new URLSearchParams(window.location.search)
    const tokenFromUrl = urlParams.get('token')

    if (tokenFromUrl) {
      // Store token immediately (synchronously during init)
      localStorage.setItem('authToken', tokenFromUrl)

      // Try to extract email from JWT token payload
      let urlEmail = null, urlName = null;
      try {
        const payload = JSON.parse(atob(tokenFromUrl.split('.')[1]))
        if (payload.email) {
          urlEmail = payload.email;
          localStorage.setItem('userEmail', urlEmail)
          if (!localStorage.getItem('userName')) {
            urlName = urlEmail.split('@')[0];
            localStorage.setItem('userName', urlName)
          } else {
            urlName = localStorage.getItem('userName');
          }
        }
      } catch (e) {
        console.error('Failed to parse token:', e)
      }

      // Push tokens to extension
      sendTokensToExtension(tokenFromUrl, null, urlEmail, urlName);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)

      return true // User is authenticated
    }

    // Otherwise check localStorage
    return !!localStorage.getItem('authToken')
  })

  // Silent automatic session token refresh setup
  useEffect(() => {
    if (!isAuthenticated) return

    const checkAndRefreshToken = async () => {
      const token = localStorage.getItem('authToken')
      const refreshToken = localStorage.getItem('refreshToken')
      if (!token || !refreshToken) return

      try {
        // Decode JWT payload
        const payload = JSON.parse(atob(token.split('.')[1]))
        const exp = payload.exp * 1000 // to milliseconds
        const timeToExpiry = exp - Date.now()

        // Refresh token if it expires in less than 30 minutes
        if (timeToExpiry < 30 * 60 * 1000) {
          console.log('[Auth] Token expiring soon. Initiating background refresh...');
          const newToken = await refreshSession()
          if (newToken) {
            console.log('[Auth] Token successfully refreshed in background.')
          } else {
            console.warn('[Auth] Background refresh failed.')
          }
        }
      } catch (err) {
        console.error('[Auth] Error executing background refresh:', err)
      }
    }

    // Check token freshness immediately, then every 5 minutes
    checkAndRefreshToken()
    const refreshInterval = setInterval(checkAndRefreshToken, 5 * 60 * 1000)

    const handleFocus = () => {
      console.log('[Auth] Window focused, checking session freshness...');
      checkAndRefreshToken();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
    }
  }, [isAuthenticated])

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  // Listen for changes in localStorage from other tabs/windows to prevent cross-account contamination
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'userEmail' && e.newValue !== e.oldValue) {
        console.log('[Auth] Detected user account change in another tab/window. Reloading page...');
        window.location.reload();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [])

  // Auto-detect extension ID from the injected content-bridge script
  useEffect(() => {
    const handleExtensionDetected = (event) => {
      if (event.data?.type === 'BOOKSMART_EXTENSION_INSTALLED') {
        const detectedId = event.data.extensionId;
        if (detectedId && detectedId !== localStorage.getItem('booksmartExtensionId')) {
          console.log('[BookSmart] Auto-detected extension ID:', detectedId);
          localStorage.setItem('booksmartExtensionId', detectedId);
          
          // If already authenticated, sync tokens to the newly detected extension immediately
          const token = localStorage.getItem('authToken');
          const refreshToken = localStorage.getItem('refreshToken');
          const email = localStorage.getItem('userEmail');
          const name = localStorage.getItem('userName');
          if (token) {
            console.log('[BookSmart] Performing immediate sync with newly detected extension');
            sendTokensToExtension(token, refreshToken, email, name);
          }
        }
      }
    };

    window.addEventListener('message', handleExtensionDetected);

    // Ping the extension in case it is already loaded and waiting
    window.postMessage({ type: 'BOOKSMART_PING_EXTENSION' }, '*');

    return () => window.removeEventListener('message', handleExtensionDetected);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev)
  }

  const handleLogin = (token, userName) => {
    localStorage.setItem('authToken', token)
    if (userName) {
      localStorage.setItem('userName', userName)
    }
    const email = localStorage.getItem('userEmail') || null;
    const name = userName || localStorage.getItem('userName') || null;
    const refreshToken = localStorage.getItem('refreshToken') || null;
    // Push tokens to extension
    sendTokensToExtension(token, refreshToken, email, name);
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userName')
    localStorage.removeItem('userEmail')
    
    // Clear credentials in extension
    const extensionId = getExtensionId();
    if (extensionId && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage(
          extensionId,
          { type: 'BOOKSMART_AUTH_LOGOUT' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn('[BookSmart] Extension logout sync failed:', chrome.runtime.lastError.message);
            }
          }
        );
      } catch (e) {
        console.warn('[BookSmart] sendMessage logout threw:', e);
      }
    }

    setIsAuthenticated(false)
  }


  return (
    <Router>
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ?
                <Navigate to="/" replace /> :
                <Login onLogin={handleLogin} />
            }
          />
          <Route
            path="/"
            element={
              isAuthenticated ?
                <Dashboard
                  darkMode={darkMode}
                  toggleDarkMode={toggleDarkMode}
                  onLogout={handleLogout}
                /> :
                <Navigate to="/login" replace />
            }
          />
          <Route
            path="/dashboard"
            element={<Navigate to="/" replace />}
          />
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
