import { useState, useEffect } from 'react'
import { X, Save, Tag as TagIcon } from 'lucide-react'
import useBookmarkStore from '../store/useBookmarkStore'

function EditBookmarkModal({ bookmark, onClose }) {
  const [title, setTitle] = useState(bookmark.title || '')
  const [tags, setTags] = useState(bookmark.tags ? bookmark.tags.join(', ') : '')
  const [notes, setNotes] = useState(bookmark.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const { updateBookmark } = useBookmarkStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const tagArray = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t)

      await updateBookmark(bookmark.id, {
        title,
        tags: tagArray,
        notes: notes
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Edit Bookmark</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-light-bg dark:hover:bg-dark-bg rounded transition-colors"
            disabled={saving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full"
              placeholder="Bookmark title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">
              Tags (comma-separated)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <TagIcon className="h-4 w-4 text-light-text-secondary" />
              </div>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="input w-full pl-10"
                placeholder="tech, ai, reading"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">
              Personal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full h-32 py-2"
              placeholder="Add your own thoughts, summary, or reminders..."
            />
          </div>

          {/* Metadata Display (Read-only for context) */}
          {(bookmark.author || bookmark.site_name) && (
            <div className="pt-2 border-t border-light-border dark:border-dark-border grid grid-cols-2 gap-4">
              {bookmark.author && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Author
                  </label>
                  <p className="text-sm truncate">{bookmark.author}</p>
                </div>
              )}
              {bookmark.site_name && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Website
                  </label>
                  <p className="text-sm truncate">{bookmark.site_name}</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium hover:bg-light-bg dark:hover:bg-dark-bg rounded-lg transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditBookmarkModal
