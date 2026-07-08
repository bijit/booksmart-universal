import { useState } from 'react'
import { BookmarkPlus, Mail, X } from 'lucide-react'
import { API_BASE_URL } from '../config'

function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState('')

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

      // Extract token from response
      const token = data.session?.access_token || data.token
      
      // If we're registering and there's no token, it means email confirmation is required
      if (!isLogin && !token) {
        setLoading(false)
        setError('')
        // Change the UI to show a success message
        const formDiv = document.querySelector('form').parentElement;
        formDiv.innerHTML = `
          <div class="text-center py-6">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 class="text-2xl font-bold mb-2">Check your email!</h2>
            <p class="text-light-text-secondary dark:text-dark-text-secondary mb-6">We sent a verification link to <strong>${email}</strong>.</p>
            <p class="text-sm">Please click the link to activate your account, then come back here to log in.</p>
          </div>
        `;
        return;
      }

      if (!token) {
        throw new Error('No auth token received from server')
      }

      // Extract user name and email
      const userName = data.user?.name || data.user?.email?.split('@')[0] || 'User'
      const userEmail = data.user?.email || email

      // Store token and user info
      localStorage.setItem('userEmail', userEmail)
      if (data.session?.refresh_token) {
        localStorage.setItem('refreshToken', data.session.refresh_token)
      }
      onLogin(token, userName)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      // Find the Supabase configuration or URL in env/store to connect directly
      // Since the backend handles Supabase connections, we redirect through the backend auth route if supported, 
      // or if using standard supabase-js client directly. Since we don't have supabase client instantiated in the frontend directly
      // (requests go to API_BASE_URL), we redirect to the backend's OAuth trigger endpoint.
      const redirectUrl = `${API_BASE_URL.replace('/api', '')}/auth/google`
      window.location.href = redirectUrl
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess(false)
    setForgotLoading(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const redirectUrl = `${window.location.origin}/reset-password`

      const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          email: forgotEmail,
          redirectTo: redirectUrl
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.msg || errorData.message || 'Failed to send recovery email')
      }

      setForgotSuccess(true)
      setForgotEmail('')
    } catch (err) {
      setForgotError(err.message)
    } finally {
      setForgotLoading(false)
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
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="password" className="block text-sm font-medium">
                    Password
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotSuccess(false)
                        setForgotError('')
                        setShowForgotModal(true)
                      }}
                      className="text-xs text-accent hover:underline font-semibold"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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

            {/* Google OAuth Login Option */}
            <div className="mt-6">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase">Or continue with</span>
                <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="mt-4 flex items-center justify-center gap-3 w-full py-2.5 border border-light-border dark:border-dark-border rounded-xl text-sm font-bold bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google</span>
              </button>
            </div>
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

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-150 dark:border-gray-800">
              <h3 className="text-md font-bold text-gray-900 dark:text-white">Recover Password</h3>
              <button 
                onClick={() => setShowForgotModal(false)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4 py-2 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">Recovery Email Sent</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Please check your inbox (and spam) for a secure reset link.</p>
                </div>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2.5 bg-gray-100 dark:bg-gray-850 hover:bg-gray-200 text-xs font-bold rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Enter your email address below, and we will send you a secure link to reset your account password.
                </p>

                {forgotError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl">
                    <p className="text-[11px] text-red-700 dark:text-red-300 font-semibold">{forgotError}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="forgot-email" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Email Address</label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-light-bg dark:bg-dark-bg/60 border border-light-border dark:border-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-2.5 bg-accent hover:bg-accent-dark text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{forgotLoading ? 'Sending...' : 'Send Recovery Email'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Login
