import { useState } from 'react'
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react'
import { API_BASE_URL } from '../config'

function ImportBookmarks({ onClose, onImportComplete }) {
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Parse Chrome bookmarks HTML file
  const parseBookmarksHTML = (html) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const links = doc.querySelectorAll('a')
    const bookmarks = []

    links.forEach(link => {
      const url = link.getAttribute('href')
      const title = link.textContent

      if (url && url.startsWith('http')) {
        bookmarks.push({ url, title })
      }
    })

    return bookmarks
  }

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.name.endsWith('.html')) {
      setError('Please upload an HTML file exported from your browser')
      return
    }

    try {
      setImporting(true)
      setError(null)

      // Read file
      const text = await file.text()
      const bookmarks = parseBookmarksHTML(text)

      if (bookmarks.length === 0) {
        setError('No valid bookmarks found in the file')
        setImporting(false)
        return
      }

      // Send to backend
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE_URL}/import/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookmarks })
      })

      if (!response.ok) {
        throw new Error('Failed to start import')
      }

      const data = await response.json()
      const jobId = data.jobId

      // Poll for progress
      await pollProgress(jobId, bookmarks.length)

    } catch (err) {
      console.error('Import error:', err)
      setError(err.message || 'Failed to import bookmarks')
      setImporting(false)
    }
  }

  // Poll import progress
  const pollProgress = async (jobId, total) => {
    const token = localStorage.getItem('authToken')

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/import/${jobId}/status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to get status')
        }

        const status = await response.json()

        setProgress({
          processed: status.processedBookmarks,
          total: total,
          percentage: status.progress
        })

        if (status.status === 'completed') {
          clearInterval(interval)
          setImporting(false)
          setSuccess(true)

          // Call completion callback after 2 seconds
          setTimeout(() => {
            onImportComplete?.()
            onClose()
          }, 2000)
        }
      } catch (err) {
        clearInterval(interval)
        setError(err.message)
        setImporting(false)
      }
    }, 2000)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Import Bookmarks</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-light-bg dark:hover:bg-dark-bg rounded transition-colors"
            disabled={importing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Import Complete!</p>
            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
              Your bookmarks are being processed by AI.
              <br />
              Check back in a few minutes.
            </p>
          </div>
        ) : importing ? (
          // Progress State
          <div className="py-8">
            <div className="text-center mb-6">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
              <p className="mt-4 text-lg font-medium">Importing bookmarks...</p>
            </div>

            {progress && (
              <div>
                <div className="w-full bg-light-bg dark:bg-dark-bg rounded-full h-3 mb-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-accent-dark transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
                <p className="text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  {progress.processed} / {progress.total} ({progress.percentage}%)
                </p>
              </div>
            )}
          </div>
        ) : (
          // Upload State
          <div>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
              Upload your bookmarks HTML file exported from your browser.
            </p>

            {/* Instructions */}
            <div className="bg-light-bg dark:bg-dark-bg rounded-lg p-4 mb-4 text-sm">
              <p className="font-medium mb-2">How to export bookmarks:</p>
              <ol className="list-decimal list-inside space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
                <li>Chrome: Menu → Bookmarks → Bookmark Manager → Export</li>
                <li>Firefox: Menu → Bookmarks → Manage Bookmarks → Export</li>
                <li>Safari: File → Export Bookmarks</li>
              </ol>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* File Upload */}
            <label className="block">
              <div className="border-2 border-dashed border-light-border dark:border-dark-border rounded-lg p-8 text-center cursor-pointer hover:border-accent dark:hover:border-accent-dark transition-colors">
                <Upload className="w-12 h-12 mx-auto mb-3 text-light-text-secondary dark:text-dark-text-secondary" />
                <p className="text-sm font-medium mb-1">
                  Click to upload bookmarks file
                </p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  HTML file only
                </p>
              </div>
              <input
                type="file"
                accept=".html"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

export default ImportBookmarks
