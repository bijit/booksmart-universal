import { useState } from 'react'
import { X, MessageSquare, CheckCircle2 } from 'lucide-react'

function FeedbackModal({ isOpen, onClose }) {
  const [type, setType] = useState('bug')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both the subject and description.')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, subject, message })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.message || 'Failed to submit feedback')
      }

      setSuccess(true)
      setSubject('')
      setMessage('')
      // Auto close after 2 seconds
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-950 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-accent" />
            Share Your Feedback
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>Thank you! Your feedback has been submitted successfully.</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Feedback Category
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 text-gray-900 dark:text-white rounded-xl text-xs outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="bug">🐛 Report a Bug</option>
              <option value="feature_request">💡 Request a Feature</option>
              <option value="improvement">🚀 Recommend an Improvement</option>
              <option value="general">💬 General Question / Other</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Broken search logic, suggestion for visual layout..."
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 text-gray-900 dark:text-white rounded-xl text-xs outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please provide as much detail as possible..."
              rows="4"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 text-gray-900 dark:text-white rounded-xl text-xs outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm mt-2"
          >
            <span>{loading ? 'Submitting...' : 'Submit Feedback'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}

export default FeedbackModal
