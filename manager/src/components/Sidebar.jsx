import { useState } from 'react'
import { X, Tag, SortAsc, Search, Check, FolderTree } from 'lucide-react'
import TimelineSlider from './TimelineSlider'
import FolderExplorer from './FolderExplorer'
import useBookmarkStore from '../store/useBookmarkStore'


function Sidebar() {
  const {
    bookmarks,
    selectedTags,
    toggleTag,
    setSelectedTags,
    clearTags,
    sortBy,
    setSortBy,
    dateRange,
    setDateRange,
    clearDateRange,
    selectedFolder,
    clearFolder
  } = useBookmarkStore()
  
  const [tagSearch, setTagSearch] = useState('')

  const allTags = [...new Set(bookmarks.flatMap(b => b.tags || []))]
    .sort((a, b) => a.localeCompare(b))

  const searchTerms = tagSearch.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '')
  const filteredTags = allTags.filter(tag => {
    if (searchTerms.length === 0) return true
    return searchTerms.some(term => tag.toLowerCase().includes(term))
  })

  const handleSelectAllFiltered = () => {
    const newSelectedTags = [...new Set([...selectedTags, ...filteredTags])]
    setSelectedTags(newSelectedTags)
  }

  // Count bookmarks per tag
  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = bookmarks.filter(b => b.tags?.includes(tag)).length
    return acc
  }, {})

  return (
    <aside className="w-full h-full bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border p-6 overflow-y-auto">
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

      {/* Folders */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
            <h3 className="font-medium text-sm">Folders</h3>
          </div>
          {selectedFolder && (
            <button
              onClick={clearFolder}
              className="text-xs text-accent dark:text-accent-dark hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <FolderExplorer />
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

        {allTags.length > 5 && (
          <div className="mb-3">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-light-text-secondary dark:text-dark-text-secondary" />
              <input
                type="text"
                placeholder="Search tags (e.g. ai, web)..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {tagSearch && (
                <button 
                  onClick={() => setTagSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-light-text-secondary hover:text-accent"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            
            {tagSearch && filteredTags.length > 0 && (
              <button
                onClick={handleSelectAllFiltered}
                className="w-full flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] font-medium uppercase tracking-wider text-accent border border-accent/20 rounded hover:bg-accent/5 transition-colors"
              >
                <Check className="w-3 h-3" />
                Select All Matching
              </button>
            )}
          </div>
        )}

        {allTags.length === 0 ? (
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
            No tags yet
          </p>
        ) : filteredTags.length === 0 ? (
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary py-2 italic text-center">
            No matching tags
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredTags.map(tag => (
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

      {/* Timeline Slider */}
      <TimelineSlider
        bookmarks={bookmarks}
        dateRange={dateRange}
        setDateRange={setDateRange}
        clearDateRange={clearDateRange}
      />

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
