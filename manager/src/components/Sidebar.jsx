import { X, Tag, Calendar, SortAsc } from 'lucide-react'
import useBookmarkStore from '../store/useBookmarkStore'

function Sidebar() {
  const {
    bookmarks,
    selectedTags,
    toggleTag,
    clearTags,
    sortBy,
    setSortBy,
    dateRange,
    setDateRange,
    clearDateRange
  } = useBookmarkStore()

  // Get all unique tags from bookmarks
  const allTags = [...new Set(bookmarks.flatMap(b => b.tags || []))]
    .sort((a, b) => a.localeCompare(b))

  // Count bookmarks per tag
  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = bookmarks.filter(b => b.tags?.includes(tag)).length
    return acc
  }, {})

  return (
    <aside className="w-64 h-full bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border p-6 overflow-y-auto">
      {/* Sort */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <SortAsc className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
          <h3 className="font-medium text-sm">Sort By</h3>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="input text-sm"
        >
          <option value="date_added">Date Added</option>
          <option value="title">Title</option>
          <option value="date_published">Date Published</option>
        </select>
      </div>

      {/* Tags */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
            <h3 className="font-medium text-sm">Tags</h3>
          </div>
          {selectedTags.length > 0 && (
            <button
              onClick={clearTags}
              className="text-xs text-accent dark:text-accent-dark hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        {allTags.length === 0 ? (
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
            No tags yet
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-accent text-white'
                    : 'hover:bg-light-bg dark:hover:bg-dark-bg'
                }`}
              >
                <span className="truncate">{tag}</span>
                <span className={`text-xs ml-2 ${
                  selectedTags.includes(tag) ? 'text-white/80' : 'text-light-text-secondary dark:text-dark-text-secondary'
                }`}>
                  {tagCounts[tag]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date Range */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
            <h3 className="font-medium text-sm">Date Range</h3>
          </div>
          {(dateRange.start || dateRange.end) && (
            <button
              onClick={clearDateRange}
              className="text-xs text-accent dark:text-accent-dark hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-2">
          <input
            type="date"
            value={dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''}
            onChange={(e) => setDateRange(e.target.value ? new Date(e.target.value) : null, dateRange.end)}
            className="input text-sm"
            placeholder="Start date"
          />
          <input
            type="date"
            value={dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''}
            onChange={(e) => setDateRange(dateRange.start, e.target.value ? new Date(e.target.value) : null)}
            className="input text-sm"
            placeholder="End date"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="pt-6 border-t border-light-border dark:border-dark-border">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-light-text-secondary dark:text-dark-text-secondary">Total Bookmarks</span>
            <span className="font-medium">{bookmarks.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-light-text-secondary dark:text-dark-text-secondary">Tags</span>
            <span className="font-medium">{allTags.length}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
