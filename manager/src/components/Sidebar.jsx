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


      {/* Tags Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-accent/10 rounded-lg">
              <Tag className="w-4 h-4 text-accent" />
            </div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Tags</h3>
          </div>
          {selectedTags.length > 0 && (
            <button
              onClick={clearTags}
              className="text-xs font-medium text-accent hover:text-accent-dark transition-colors px-2 py-1 bg-accent/5 rounded-md"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Selected Tags (Active Filters) */}
        {selectedTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 animate-fadeIn">
            {selectedTags.map(tag => (
              <button
                key={`active-${tag}`}
                onClick={() => toggleTag(tag)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-full shadow-sm hover:bg-accent-dark transition-all transform hover:scale-105"
              >
                <span>{tag}</span>
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {/* Tag Search */}
        <div className="relative mb-4 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary group-focus-within:text-accent transition-colors" />
          <input
            type="text"
            placeholder="Filter tags..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-light-bg/50 dark:bg-dark-bg/50 border border-light-border dark:border-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
          {tagSearch && (
            <button 
              onClick={() => setTagSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-light-text-secondary hover:text-accent bg-light-bg dark:bg-dark-bg rounded-md shadow-sm"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Tag Selection Actions */}
        {tagSearch && filteredTags.length > 0 && (
          <button
            onClick={handleSelectAllFiltered}
            className="w-full mb-4 flex items-center justify-center gap-1.5 py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-accent bg-accent/5 border border-accent/20 rounded-xl hover:bg-accent/10 transition-all active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            Select {filteredTags.length} Matching
          </button>
        )}

        {/* Tags List (Pills) */}
        {allTags.length === 0 ? (
          <div className="text-center py-4 px-2 border-2 border-dashed border-light-border dark:border-dark-border rounded-2xl">
             <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">No tags yet</p>
          </div>
        ) : filteredTags.length === 0 ? (
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary py-4 italic text-center">
            No matching tags found
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
            {filteredTags.map(tag => {
              const isSelected = selectedTags.includes(tag);
              if (isSelected) return null; // Don't show in the main list if already in "Active"
              
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="group flex items-center gap-1.5 px-3 py-1.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-full text-xs font-medium hover:border-accent hover:text-accent hover:shadow-sm transition-all active:scale-95"
                >
                  <span className="max-w-[120px] truncate">{tag}</span>
                  <span className="px-1.5 py-0.5 bg-light-border dark:bg-dark-border text-[9px] rounded-full group-hover:bg-accent/10 group-hover:text-accent">
                    {tagCounts[tag]}
                  </span>
                </button>
              );
            })}
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
