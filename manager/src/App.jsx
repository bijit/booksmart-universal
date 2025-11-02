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

  const handleLogin = (token) => {
    localStorage.setItem('authToken', token)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken')
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
        </Routes>
      </div>
    </Router>
  )
}

export default App
