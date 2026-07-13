import { useState } from 'react'
import { X, ShieldAlert, Trash2, Calendar, RefreshCw, CheckCircle2 } from 'lucide-react'

function SettingsModal({ isOpen, onClose, onLogout, userMetadata, onUpdateMetadata }) {
  const [retentionDays, setRetentionDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [confirmText, setConfirmText] = useState('')

  if (!isOpen) return null

  const getProfileDetails = () => {
    let email = ''
    let name = ''

    try {
      const token = localStorage.getItem('authToken')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        email = payload.email || payload.user?.email || ''
        name = payload.user_metadata?.name || payload.user_metadata?.full_name || payload.name || ''
      }
    } catch (e) {
      console.error('Failed to parse profile details from JWT:', e)
    }

    // Fallbacks to localStorage
    if (!email) {
      email = localStorage.getItem('userEmail') || ''
    }
    if (!name) {
      name = localStorage.getItem('userName') || localStorage.getItem('userEmail') || ''
    }

    // Ultimate placeholders to ensure it is never blank
    return {
      email: email || 'N/A',
      name: name || 'User'
    }
  }

  const { email: userEmail, name: userName } = getProfileDetails()
  const scheduledDeletionAt = userMetadata?.scheduled_deletion_at

  const handleDeactivate = async () => {
    setError(null)
    setSuccess(null)

    if (retentionDays === 0 && confirmText.trim().toLowerCase() !== 'delete') {
      setError('Please type "delete" to confirm permanent account purge.')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ retentionDays })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.message || 'Failed to process account deletion request')
      }

      const result = await response.json()

      if (result.status === 'deleted') {
        setSuccess('Your account was successfully permanently deleted.')
        // Wait 1.5s then logout
        setTimeout(() => {
          onLogout()
        }, 1500)
      } else {
        setSuccess('Your account has been scheduled for deletion in 30 days.')
        if (onUpdateMetadata) {
          onUpdateMetadata({ scheduled_deletion_at: result.scheduled_deletion_at })
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReactivate = async () => {
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/reactivate-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.message || 'Failed to reactivate account')
      }

      const result = await response.json()
      setSuccess('Your account was successfully reactivated!')
      if (onUpdateMetadata) {
        onUpdateMetadata({ scheduled_deletion_at: null })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-950 dark:text-white">Account Settings</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Profile Overview */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Profile Details</h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-150 dark:border-gray-800 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Name</span>
                <span className="font-semibold text-gray-900 dark:text-white">{userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Email</span>
                <span className="font-semibold text-gray-900 dark:text-white">{userEmail}</span>
              </div>
            </div>
          </div>

          {/* Deletion & Retention Status Card */}
          {scheduledDeletionAt ? (
            <div className="p-5 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-400">Account Scheduled for Deletion</h4>
                  <p className="text-xs text-yellow-750 dark:text-yellow-500/90 mt-1 leading-relaxed">
                    Your account is set to be permanently removed on:
                    <br />
                    <span className="font-bold">{new Date(scheduledDeletionAt).toLocaleString()}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleReactivate}
                disabled={loading}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Reactivating...' : 'Cancel Deletion & Reactivate Account'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 pt-2 border-t border-gray-150 dark:border-gray-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Danger Zone
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Select Deletion Strategy
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRetentionDays(30)}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        retentionDays === 30
                          ? 'border-accent bg-accent/5 dark:border-accent-dark dark:bg-accent-dark/5'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850'
                      }`}
                    >
                      <p className="text-xs font-bold text-gray-900 dark:text-white">30-Day Retention</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Soft-delete. Restore access anytime within 30 days.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRetentionDays(0)}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        retentionDays === 0
                          ? 'border-red-500 bg-red-500/5 dark:border-red-500 dark:bg-red-500/5'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850'
                      }`}
                    >
                      <p className="text-xs font-bold text-red-600 dark:text-red-400">Immediate Purge</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Permanently erase bookmarks, notes, vectors, and login credentials.</p>
                    </button>
                  </div>
                </div>

                {retentionDays === 0 && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-750 dark:text-gray-300">
                      Confirm permanent purge by typing <span className="text-red-500">"delete"</span> below:
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder='Type "delete"'
                      className="w-full px-4 py-2 border border-red-200 dark:border-red-900/40 bg-red-50/10 dark:bg-red-950/10 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                )}

                <button
                  onClick={handleDeactivate}
                  disabled={loading || (retentionDays === 0 && confirmText.trim().toLowerCase() !== 'delete')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm text-white ${
                    retentionDays === 0
                      ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50'
                      : 'bg-gray-800 hover:bg-gray-950 dark:bg-gray-750 dark:hover:bg-gray-700'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {loading
                      ? 'Processing...'
                      : retentionDays === 0
                      ? 'Permanently Delete Account Now'
                      : 'Deactivate with 30-Day Recovery Period'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
