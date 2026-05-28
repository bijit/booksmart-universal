import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'

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
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]))
          if (payload.email) {
            localStorage.setItem('userEmail', payload.email)
            localStorage.setItem('userName', payload.user_metadata?.name || payload.email.split('@')[0])
          }
        } catch (e) {
          console.error('Failed to parse OAuth session payload:', e)
        }

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
      try {
        const payload = JSON.parse(atob(tokenFromUrl.split('.')[1]))
        if (payload.email) {
          localStorage.setItem('userEmail', payload.email)
          if (!localStorage.getItem('userName')) {
            localStorage.setItem('userName', payload.email.split('@')[0])
          }
        }
      } catch (e) {
        console.error('Failed to parse token:', e)
      }

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
              localStorage.setItem('authToken', data.session.access_token)
              if (data.session.refresh_token) {
                localStorage.setItem('refreshToken', data.session.refresh_token)
              }
              console.log('[Auth] Token successfully refreshed in background.')
            }
          } else {
            console.warn('[Auth] Background refresh failed, status:', response.status)
          }
        }
      } catch (err) {
        console.error('[Auth] Error executing background refresh:', err)
      }
    }

    // Check token freshness immediately, then every 5 minutes
    checkAndRefreshToken()
    const refreshInterval = setInterval(checkAndRefreshToken, 5 * 60 * 1000)

    return () => clearInterval(refreshInterval)
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

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev)
  }

  const handleLogin = (token, userName) => {
    localStorage.setItem('authToken', token)
    if (userName) {
      localStorage.setItem('userName', userName)
    }
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userName')
    localStorage.removeItem('userEmail')
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
