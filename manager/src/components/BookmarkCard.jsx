import { useState } from 'react'
import { ExternalLink, Trash2, Calendar, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import useBookmarkStore from '../store/useBookmarkStore'

function BookmarkCard({ bookmark }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { deleteBookmark, toggleTag } = useBookmarkStore()

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bookmark?')) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteBookmark(bookmark.id)
    } catch (error) {
      alert('Failed to delete bookmark: ' + error.message)
      setIsDeleting(false)
    }
  }

  const handleTagClick = (tag) => {
    toggleTag(tag)
  }

  return (
    <div className={`card group ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Favicon */}
            {bookmark.favicon_url ? (
              <img
                src={bookmark.favicon_url}
                alt=""
                className="w-5 h-5 mt-1 flex-shrink-0 rounded"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <div className="w-5 h-5 mt-1 flex-shrink-0 bg-light-border dark:bg-dark-border rounded flex items-center justify-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <ExternalLink className="w-3 h-3" />
              </div>
            )}
            <h3 className="text-lg font-semibold line-clamp-2 flex-1 min-w-0">
              {bookmark.title || 'Untitled'}
            </h3>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
              title="Open bookmark"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors"
              title="Delete bookmark"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        {bookmark.description && (
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary line-clamp-5 mb-4">
            {bookmark.description}
          </p>
        )}

        {/* Tags */}
        {bookmark.tags && bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {bookmark.tags.slice(0, 5).map((tag, index) => (
              <span
                key={index}
                onClick={() => handleTagClick(tag)}
                className="tag"
              >
                {tag}
              </span>
            ))}
            {bookmark.tags.length > 5 && (
              <span className="tag">
                +{bookmark.tags.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
          <div className="flex items-center gap-4">
            {bookmark.created_at && (
              <div className="flex items-center gap-1" title={new Date(bookmark.created_at).toLocaleString()}>
                <Clock className="w-3 h-3" />
                <span>{formatDistanceToNow(new Date(bookmark.created_at), { addSuffix: true })}</span>
              </div>
            )}
            {bookmark.published_date && (
              <div className="flex items-center gap-1" title={new Date(bookmark.published_date).toLocaleString()}>
                <Calendar className="w-3 h-3" />
                <span>{new Date(bookmark.published_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          {bookmark.processing_status === 'pending' && (
            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded text-xs">
              Processing...
            </span>
          )}
          {bookmark.processing_status === 'failed' && (
            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
              Failed
            </span>
          )}
        </div>

        {/* URL */}
        <div className="mt-3 pt-3 border-t border-light-border dark:border-dark-border">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent dark:text-accent-dark hover:underline line-clamp-1"
          >
            {bookmark.url}
          </a>
        </div>
      </div>
    </div>
  )
}

export default BookmarkCard
