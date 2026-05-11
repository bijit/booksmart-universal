import { useEffect, useState, useRef, useCallback } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import BookmarkCard from '../components/BookmarkCard'

import TagCloudView from '../components/TagCloudView'
import EmptyState from '../components/EmptyState'
import ImportBookmarks from '../components/ImportBookmarks'
import Pagination from '../components/Pagination'
import useBookmarkStore from '../store/useBookmarkStore'
import { Sparkles, LayoutGrid, Columns, Globe, ExternalLink } from 'lucide-react'

function Dashboard({ darkMode, toggleDarkMode, onLogout }) {
  const [showImport, setShowImport] = useState(false)
  const {
    loading,
    error,
    fetchBookmarks,
    goToPage,
    getFilteredBookmarks,
    viewMode,
    searchQuery,
    aiAnswer,
    dateRange,
    selectedTags,
    sortBy,
    currentPage,
    totalPages,
    researchOnWeb
  } = useBookmarkStore()
  
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [layoutMode, setLayoutMode] = useState('gallery')
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef(null)

  const startResizing = useCallback((e) => {
    setIsResizing(true)
    e.preventDefault()
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback((e) => {
    if (isResizing) {
      const newWidth = e.clientX
      if (newWidth > 200 && newWidth < 600) {
        setSidebarWidth(newWidth)
      }
    }
  }, [isResizing])

  useEffect(() => {
    window.addEventListener('mousemove', resize)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [resize, stopResizing])


  useEffect(() => {
    fetchBookmarks()

    // Poll for updates every 5 minutes
    const interval = setInterval(() => {
      fetchBookmarks()
    }, 300000)

    return () => clearInterval(interval)
  }, [fetchBookmarks])

  const filteredBookmarks = getFilteredBookmarks()

  return (
    <div className="flex flex-col h-screen">
      <Header
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onLogout={onLogout}
        onOpenImport={() => setShowImport(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Hidden on mobile */}
        <div 
          className="hidden lg:flex lg:h-full relative flex-shrink-0"
          style={{ width: `${sidebarWidth}px` }}
        >
          <Sidebar />
          
          {/* Resize Handle */}
          <div
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent/50 transition-colors ${isResizing ? 'bg-accent' : 'bg-transparent'}`}
            onMouseDown={startResizing}
          />
        </div>


        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            
            {/* Search Header */}
            {searchQuery && (
              <div className="mb-6 flex items-baseline justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span>Results for</span>
                  <span className="text-accent dark:text-accent-dark italic">"{searchQuery}"</span>
                </h2>
                {!loading && (
                  <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">
                    {filteredBookmarks.length} matches
                  </span>
                )}
              </div>
            )}
            {/* AI Overview (RAG) Section */}
            {searchQuery && (loading || aiAnswer) && (
              <div className="mb-8 p-6 bg-gradient-to-br from-accent/10 to-accent-dark/10 dark:from-accent/20 dark:to-accent-dark/20 rounded-2xl border border-accent/20 dark:border-accent-dark/20 shadow-lg shadow-accent/5 overflow-hidden relative">
                {/* Decorative background element */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-accent text-white rounded-lg">
                      <Sparkles className={`w-5 h-5 ${loading ? 'animate-pulse' : ''}`} />
                    </div>
                    <h3 className="text-lg font-bold">AI Overview</h3>
                  </div>

                  {loading ? (
                    <div className="space-y-3">
                      <div className="h-4 bg-accent/10 rounded w-3/4 animate-pulse"></div>
                      <div className="h-4 bg-accent/10 rounded w-full animate-pulse delay-75"></div>
                      <div className="h-4 bg-accent/10 rounded w-2/3 animate-pulse delay-150"></div>
                    </div>
                  ) : aiAnswer ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="text-light-text dark:text-dark-text leading-relaxed mb-6 prose dark:prose-invert max-w-none">
                        {aiAnswer.answer}
                      </div>
                      
                      {aiAnswer.sources && aiAnswer.sources.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-accent/10">
                          <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary w-full mb-1">Sources</span>
                          {aiAnswer.sources.map((source) => (
                            <div 
                              key={source.index}
                              className="flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-dark-card border border-accent/20 rounded-full text-xs font-medium text-light-text hover:border-accent transition-colors"
                            >
                              <span className="flex items-center justify-center w-4 h-4 bg-accent text-white rounded-full text-[10px]">{source.index}</span>
                              <span className="truncate max-w-[150px]">{source.title}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end mt-4 pt-4 border-t border-accent/5">
                        <button
                          type="button"
                          onClick={(e) => researchOnWeb(e)}
                          disabled={loading}
                          className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-dark-card/50 hover:bg-white dark:hover:bg-dark-card border border-accent/20 rounded-xl text-sm font-bold text-accent dark:text-accent-dark transition-all hover:shadow-md active:scale-95 disabled:opacity-50"
                        >
                          <Globe className="w-4 h-4" />
                          <span>Expand Search to Web</span>
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Loading State for Bookmarks */}
            {loading && filteredBookmarks.length === 0 && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-accent dark:border-accent-dark border-t-transparent"></div>
                  <p className="mt-4 text-light-text-secondary dark:text-dark-text-secondary">
                    Loading bookmarks...
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <p className="text-red-700 dark:text-red-300">
                  Error: {error}
                </p>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredBookmarks.length === 0 && (
              <EmptyState />
            )}

            {/* Cards View */}
            {!loading && filteredBookmarks.length > 0 && viewMode === 'cards' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredBookmarks.map(bookmark => (
                    <BookmarkCard key={bookmark.id} bookmark={bookmark} />
                  ))}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  loading={loading}
                />
              </>
            )}

            {/* List View */}
            {!loading && filteredBookmarks.length > 0 && viewMode === 'list' && (
              <>
                <div className="space-y-3 sm:space-y-4">
                  {filteredBookmarks.map(bookmark => (
                    <BookmarkCard key={bookmark.id} bookmark={bookmark} />
                  ))}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  loading={loading}
                />
              </>
            )}

            {/* Timeline View */}
            {!loading && filteredBookmarks.length > 0 && viewMode === 'timeline' && (
              <>
                <div className="space-y-8">
                  {filteredBookmarks.reduce((acc, bookmark) => {
                    const date = new Date(bookmark.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })

                    if (!acc[date]) {
                      acc[date] = []
                    }
                    acc[date].push(bookmark)
                    return acc
                  }, {}) && Object.entries(
                    filteredBookmarks.reduce((acc, bookmark) => {
                      const date = new Date(bookmark.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })

                      if (!acc[date]) {
                        acc[date] = []
                      }
                      acc[date].push(bookmark)
                      return acc
                    }, {})
                  ).map(([date, bookmarks]) => (
                    <div key={date}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 sm:gap-3 flex-1">
                          <span className="text-accent dark:text-accent-dark whitespace-nowrap">{date}</span>
                          <div className="flex-1 h-px bg-light-border dark:bg-dark-border min-w-0 mr-4"></div>
                        </h2>
                        
                        {/* Layout Toggle - only show on first group if multiple dates */}
                        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-light-border dark:border-dark-border">
                          <button
                            onClick={() => setLayoutMode('gallery')}
                            className={`p-1.5 rounded-md transition-colors ${layoutMode === 'gallery' ? 'bg-white dark:bg-gray-700 shadow-sm text-accent dark:text-accent-dark' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            title="Gallery View"
                          >
                            <LayoutGrid className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setLayoutMode('pinterest')}
                            className={`p-1.5 rounded-md transition-colors ${layoutMode === 'pinterest' ? 'bg-white dark:bg-gray-700 shadow-sm text-accent dark:text-accent-dark' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            title="Pinterest View"
                          >
                            <Columns className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className={
                        layoutMode === 'pinterest' 
                          ? "columns-1 md:columns-2 xl:columns-3 gap-4 sm:gap-6 space-y-4 sm:space-y-6" 
                          : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6"
                      }>
                        {bookmarks.map(bookmark => (
                          <div key={bookmark.id} className={layoutMode === 'pinterest' ? "break-inside-avoid" : ""}>
                            <BookmarkCard bookmark={bookmark} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  loading={loading}
                />
              </>
            )}

            {/* Grouped by Tag View */}
            {!loading && filteredBookmarks.length > 0 && viewMode === 'grouped' && (
              <TagCloudView bookmarks={filteredBookmarks} />
            )}
          </div>
        </main>
      </div>

      {/* Import Modal */}
      {showImport && (
        <ImportBookmarks
          onClose={() => setShowImport(false)}
          onImportComplete={() => {
            fetchBookmarks()
          }}
        />
      )}
    </div>
  )
}

export default Dashboard
