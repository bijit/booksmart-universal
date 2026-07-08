import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Eye, EyeOff, Lock, Check } from 'lucide-react'
import useBookmarkStore from '../store/useBookmarkStore'

function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // In Supabase, clicking the recovery link puts token hash parameters in the URL location hash (e.g. #access_token=...&type=recovery).
    // The Supabase client automatically picks this up, sets the session in memory/cookies, and handles auth.
    // We check if an access token exists in the hash or URL search parameters, and if so, capture it.
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      const type = params.get('type')
      
      if (accessToken) {
        localStorage.setItem('authToken', accessToken)
      }
      
      // If it's a recovery, we keep the user on this page to update password
      if (type === 'recovery') {
        console.log('[Auth] Password recovery session initiated successfully.');
      }
    }
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      // Get the Supabase Config parameters
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const token = localStorage.getItem('authToken')

      if (!token) {
        throw new Error('Recovery session has expired or is invalid. Please request a new recovery email.')
      }

      // Update password using Supabase REST API
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.msg || errorData.message || 'Failed to reset password')
      }

      setSuccess(true)
      
      // Clean up token from localStorage to force standard login
      localStorage.removeItem('authToken')
      
      setTimeout(() => {
        navigate('/login')
      }, 3000)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md bg-light-card dark:bg-dark-card rounded-3xl border border-light-border dark:border-dark-border shadow-2xl p-8 space-y-6">
        
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 text-3xl font-extrabold tracking-tight mb-2">
            <span className="text-accent dark:text-accent-dark">Book</span>
            <span className="text-light-text dark:text-dark-text">Smart</span>
          </div>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            Set your new account password
          </p>
        </div>

        {success ? (
          <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">Password Updated</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Your password was successfully reset. Redirecting you to login...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl">
                <p className="text-xs text-red-700 dark:text-red-300 font-semibold">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 bg-light-bg dark:bg-dark-bg/60 border border-light-border dark:border-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 bg-light-bg dark:bg-dark-bg/60 border border-light-border dark:border-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent hover:bg-accent-dark text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default ResetPassword
