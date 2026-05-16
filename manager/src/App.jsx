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
    // Check for token in URL first (from extension SSO)
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
