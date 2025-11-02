import { useState } from 'react'
import { BookmarkPlus } from 'lucide-react'
import { API_BASE_URL } from '../config'

function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isLogin ? 'login' : 'register'
      const body = isLogin
        ? { email, password }
        : {
            name: email.split('@')[0], // Auto-generate name from email
            email,
            password
          }

      const response = await fetch(
        `${API_BASE_URL}/auth/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      // Extract token from response (Railway returns session.access_token)
      const token = data.session?.access_token || data.token
      if (!token) {
        throw new Error('No auth token received from server')
      }

      // Extract user name
      const userName = data.user?.name || data.user?.email?.split('@')[0] || 'User'

      // Store token and user info
      onLogin(token, userName)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/10 dark:bg-accent-dark/10 rounded-full mb-4">
            <BookmarkPlus className="w-8 h-8 text-accent dark:text-accent-dark" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-accent dark:text-accent-dark">Book</span>
            <span>Smart</span>
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Your intelligent bookmark library
          </p>
        </div>

        {/* Login/Register Form */}
        <div className="card">
          <div className="p-8">
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  isLogin
                    ? 'bg-accent text-white'
                    : 'bg-light-bg dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  !isLogin
                    ? 'bg-accent text-white'
                    : 'bg-light-bg dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder={isLogin ? 'Enter password' : 'Min 8 characters'}
                  required
                  minLength={isLogin ? undefined : 8}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {isLogin ? 'Logging in...' : 'Creating account...'}
                  </span>
                ) : (
                  isLogin ? 'Login' : 'Create Account'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-sm text-light-text-secondary dark:text-dark-text-secondary">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
            }}
            className="text-accent dark:text-accent-dark hover:underline font-medium"
          >
            {isLogin ? 'Register here' : 'Login here'}
          </button>
        </p>
      </div>
    </div>
  )
}

export default Login
