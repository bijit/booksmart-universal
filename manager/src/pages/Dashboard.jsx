import { useEffect, useState, useRef, useCallback } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import BookmarkCard from '../components/BookmarkCard'

import TagCloudView from '../components/TagCloudView'
import EmptyState from '../components/EmptyState'
import ImportBookmarks from '../components/ImportBookmarks'
import Pagination from '../components/Pagination'
import BookmarkDetailsModal from '../components/BookmarkDetailsModal'
import SettingsModal from '../components/SettingsModal'
import FeedbackModal from '../components/FeedbackModal'
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso'
import useBookmarkStore from '../store/useBookmarkStore'
import { Sparkles, LayoutGrid, Columns, Globe, ExternalLink, Inbox, MessageSquare } from 'lucide-react'

function Dashboard({ darkMode, toggleDarkMode, onLogout }) {
  const [showImport, setShowImport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [activeDetailsBookmark, setActiveDetailsBookmark] = useState(null)
  const mainRef = useRef(null)
  
  const [userMetadata, setUserMetadata] = useState(() => {
    try {
      const token = localStorage.getItem('authToken')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return payload.user_metadata || {}
      }
    } catch (e) {
      console.error('Failed to parse user metadata from JWT:', e)
    }
    return {}
  })
  const {
    loading,
    isDeepSearching,
    isAnswerLoading,
    error,
    fetchBookmarks,
    performSearch,
    commitSearch,
    performTextSearch,
    goToPage,
    getFilteredBookmarks,
    viewMode,
    searchQuery,
    aiAnswer,
    hasMoreResults,
    dateRange,
    selectedTags,
    selectedFolder,
    setSelectedFolder,
    sortBy,
    showOnlyProcessing,
    setShowOnlyProcessing,
    currentPage,
    totalPages,
    totalBookmarks,
    researchOnWeb,
    searchMode,
    sidebarWidth,
    layoutMode,
    savePreference,
    fetchPreferences
  } = useBookmarkStore()

  const filteredBookmarks = getFilteredBookmarks()

  // Calculate dynamic list header text based on active filters
  let listHeaderText = 'All Bookmarks'
  if (searchQuery) {
    let contextStr = ''
    if (selectedFolder) {
      contextStr += ` in Folder: ${selectedFolder}`
    }
    if (selectedTags && selectedTags.length > 0) {
      const tagsStr = selectedTags.map(t => `#${t}`).join(', ')
      contextStr += ` matching ${selectedTags.length === 1 ? 'Tag' : 'Tags'}: ${tagsStr}`
    }
    listHeaderText = `Search Results: "${searchQuery}"${contextStr}`
  } else if (showOnlyProcessing) {
    listHeaderText = 'Processing Queue'
  } else if (selectedFolder) {
    listHeaderText = `Folder: ${selectedFolder}`
  } else if (selectedTags && selectedTags.length > 0) {
    listHeaderText = selectedTags.length === 1
      ? `Tag: #${selectedTags[0]}`
      : `Tags: ${selectedTags.map(t => `#${t}`).join(', ')}`
  }

  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const folder = params.get('folder')
    const searchParam = params.get('search')
    
    if (folder) {
      setSelectedFolder(folder)
    }
    
    if (searchParam) {
      commitSearch(searchParam)
    }
    
    if (folder || searchParam) {
      // Clean query params so reloading doesn't pin the view
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [setSelectedFolder, commitSearch])

  const loadMoreResults = useCallback(() => {
    if (!loading && !isDeepSearching && hasMoreResults && searchQuery) {
      if (searchMode === 'semantic') {
        performSearch(searchQuery, true)
      } else {
        performTextSearch(searchQuery, true)
      }
    }
  }, [loading, isDeepSearching, hasMoreResults, searchQuery, searchMode, performSearch, performTextSearch])

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
        savePreference('sidebarWidth', newWidth)
      }
    }
  }, [isResizing, savePreference])

  useEffect(() => {
    window.addEventListener('mousemove', resize)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [resize, stopResizing])


  useEffect(() => {
    fetchPreferences()
    fetchBookmarks()

    // Poll for updates every 5 minutes
    const interval = setInterval(() => {
      fetchBookmarks()
    }, 300000)

    return () => clearInterval(interval)
  }, [fetchPreferences, fetchBookmarks])

  return (
    <div className="flex flex-col h-screen overflow-hidden relative bg-dot-grid">
      {/* Ambient Aurora Glow Blobs — more visible */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-accent/20 dark:bg-accent/15 blur-[130px]" />
        <div className="absolute bottom-[15%] right-[5%] w-[600px] h-[600px] rounded-full bg-purple-500/15 dark:bg-purple-600/20 blur-[160px]" />
        <div className="absolute top-[55%] left-[50%] w-[350px] h-[350px] rounded-full bg-indigo-400/10 dark:bg-indigo-500/10 blur-[120px]" />
      </div>

      <Header
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onLogout={onLogout}
        onOpenImport={() => setShowImport(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {userMetadata?.scheduled_deletion_at && (
        <div className="w-full bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 z-40 animate-fadeIn flex-shrink-0">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400 text-xs sm:text-sm">
            <span className="font-bold">⚠️ Notice:</span>
            <span>Your account is scheduled for permanent deletion on {new Date(userMetadata.scheduled_deletion_at).toLocaleString()}.</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-750 text-white rounded-lg text-xs font-bold transition-all"
          >
            Cancel Deletion & Reactivate
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Hidden on mobile */}
        <div
          className="hidden lg:flex h-full z-30 flex-shrink-0 relative overflow-hidden"
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
        <main ref={mainRef} className="flex-1 h-full overflow-y-auto z-10 bg-transparent scrollbar-thin">
          <div className="w-full max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">

            {/* Search Header */}
            {searchQuery && (
              <div className="mb-6 flex items-baseline justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span>Results for</span>
                  <span className="text-accent dark:text-accent-dark italic">"{searchQuery}"</span>
                  {isDeepSearching && (
                    <div className="flex items-center gap-2 ml-2 px-2 py-0.5 bg-accent/10 rounded-full">
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></div>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-accent">Deep Searching...</span>
                    </div>
                  )}
                </h2>
                {!isDeepSearching && (
                  <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">
                    {filteredBookmarks.length} matches
                  </span>
                )}
              </div>
            )}
            {/* AI Overview (RAG) Section */}
            {searchQuery && (isAnswerLoading || aiAnswer) && (
              <div className="mb-8 p-6 bg-gradient-to-br from-accent/10 to-accent-dark/10 dark:from-accent/20 dark:to-accent-dark/20 rounded-2xl border border-accent/20 dark:border-accent-dark/20 shadow-lg shadow-accent/5 overflow-hidden relative">
                {/* Decorative background element */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-accent text-white rounded-lg">
                      <Sparkles className={`w-5 h-5 ${isAnswerLoading ? 'animate-pulse' : ''}`} />
                    </div>
                    <h3 className="text-lg font-bold">AI Overview</h3>
                  </div>

                  {isAnswerLoading ? (
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

            {/* Global Toolbar (Visible as long as there are bookmarks to filter, active search, or processing filter) */}
            {!loading && !error && (filteredBookmarks.length > 0 || searchQuery || showOnlyProcessing) && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <h3 className="text-lg font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                  {listHeaderText}
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Processing Filter Toggle */}
                  <button
                    onClick={() => setShowOnlyProcessing(!showOnlyProcessing)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-bold ${
                      showOnlyProcessing 
                      ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-700 dark:text-amber-400 shadow-sm' 
                      : 'bg-gray-100 dark:bg-gray-800 border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title={showOnlyProcessing ? "Show All Bookmarks" : "Show Only Processing"}
                  >
                    <div className={`w-2 h-2 rounded-full ${showOnlyProcessing ? 'bg-amber-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span>Processing</span>
                  </button>

                  {/* Layout Toggles (For cards & timeline view) */}
                  {(viewMode === 'cards' || viewMode === 'timeline') && (
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-light-border dark:border-dark-border">
                      <button
                        onClick={() => savePreference('layoutMode', 'gallery')}
                        className={`p-1.5 rounded-md transition-colors ${layoutMode === 'gallery' ? 'bg-white dark:bg-gray-700 shadow-sm text-accent dark:text-accent-dark' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        title="Gallery View"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => savePreference('layoutMode', 'pinterest')}
                        className={`p-1.5 rounded-md transition-colors ${layoutMode === 'pinterest' ? 'bg-white dark:bg-gray-700 shadow-sm text-accent dark:text-accent-dark' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        title="Pinterest View"
                      >
                        <Columns className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredBookmarks.length === 0 && (
              totalBookmarks === 0 ? (
                <EmptyState />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
                  <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                    <Inbox className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">No bookmarks found</h3>
                  <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-sm">
                    {showOnlyProcessing
                      ? "No bookmarks are currently in the queue or being processed."
                      : searchQuery 
                        ? `We couldn't find anything matching "${searchQuery}". Try adjusting your keywords.`
                        : "No bookmarks match your selected tags, folders, or page filter."}
                  </p>
                  {showOnlyProcessing && (
                    <button
                      onClick={() => setShowOnlyProcessing(false)}
                      className="mt-4 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-semibold shadow-sm"
                    >
                      Back to Dashboard
                    </button>
                  )}
                </div>
              )
            )}

            {/* Cards View */}
            {filteredBookmarks.length > 0 && viewMode === 'cards' && (
              <>
                {layoutMode === 'pinterest' ? (
                  <div className="columns-1 md:columns-2 lg:columns-3 gap-4 sm:gap-6 space-y-4 sm:space-y-6">
                    {filteredBookmarks.map(bookmark => (
                      <div key={bookmark.id} className="break-inside-avoid">
                        <BookmarkCard 
                          bookmark={bookmark} 
                          layoutMode="pinterest" 
                          onViewDetails={setActiveDetailsBookmark} 
                        />
                      </div>
                    ))}
                    {searchQuery && hasMoreResults && (
                      <div className="flex justify-center py-8 col-span-full">
                        <button
                          onClick={loadMoreResults}
                          disabled={isDeepSearching}
                          className="px-6 py-2 bg-accent text-white rounded-full hover:bg-accent/90 transition-colors flex items-center gap-2"
                        >
                          {isDeepSearching && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>}
                          {isDeepSearching ? 'Searching...' : 'Load More Results'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <VirtuosoGrid
                    customScrollParent={mainRef.current || undefined}
                    data={filteredBookmarks}
                    endReached={loadMoreResults}
                    overscan={400}
                    increaseViewportBy={300}
                    listClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
                    itemContent={(index, bookmark) => (
                      <BookmarkCard 
                        key={bookmark.id} 
                        bookmark={bookmark} 
                        layoutMode="gallery" 
                        onViewDetails={setActiveDetailsBookmark} 
                      />
                    )}
                    components={{
                      Footer: () => (
                        searchQuery && hasMoreResults ? (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
                          </div>
                        ) : null
                      )
                    }}
                  />
                )}

              </>
            )}

            {/* List View */}
            {filteredBookmarks.length > 0 && viewMode === 'list' && (
              <>
                <Virtuoso
                  customScrollParent={mainRef.current || undefined}
                  data={filteredBookmarks}
                  endReached={loadMoreResults}
                  overscan={400}
                  increaseViewportBy={300}
                  itemContent={(index, bookmark) => (
                    <div className="mb-3 sm:mb-4">
                      <BookmarkCard 
                        key={bookmark.id} 
                        bookmark={bookmark} 
                        onViewDetails={setActiveDetailsBookmark} 
                      />
                    </div>
                  )}
                  components={{
                    Footer: () => (
                      searchQuery && hasMoreResults ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
                        </div>
                      ) : null
                    )
                  }}
                />

              </>
            )}

            {/* Timeline View */}
            {filteredBookmarks.length > 0 && viewMode === 'timeline' && (
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

                      </div>

                      <div className={
                        layoutMode === 'pinterest'
                          ? "columns-1 md:columns-2 xl:columns-3 gap-4 sm:gap-6 space-y-4 sm:space-y-6"
                          : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6"
                      }>
                        {bookmarks.map(bookmark => (
                          <div key={bookmark.id} className={layoutMode === 'pinterest' ? "break-inside-avoid" : ""}>
                            <BookmarkCard 
                              bookmark={bookmark} 
                              layoutMode={layoutMode} 
                              onViewDetails={setActiveDetailsBookmark} 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Grouped by Tag View */}
            {!loading && filteredBookmarks.length > 0 && viewMode === 'grouped' && (
              <TagCloudView bookmarks={filteredBookmarks} />
            )}

            {/* Global Pagination */}
            {!loading && !error && totalPages > 1 && selectedTags.length === 0 && !selectedFolder && (
              <div className="mt-8 mb-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  loading={loading}
                />
              </div>
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

      {activeDetailsBookmark && (
        <BookmarkDetailsModal
          bookmark={activeDetailsBookmark}
          onClose={() => setActiveDetailsBookmark(null)}
        />
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onLogout={onLogout}
        userMetadata={userMetadata}
        onUpdateMetadata={(newMeta) => {
          setUserMetadata(newMeta)
          // If we reactivated/deleted, update the localStorage/JWT if needed, or simply let the session reflect it.
          // We can sync this back into local userMetadata state so the banner updates immediately.
        }}
      />

      {/* Floating Feedback Trigger Button */}
      <button
        onClick={() => setShowFeedback(true)}
        className="fixed bottom-6 right-6 z-40 p-4 bg-accent hover:bg-accent-hover text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center border border-white/10"
        title="Share Your Feedback"
      >
        <MessageSquare className="w-6 h-6 animate-pulse" />
      </button>

      {/* Feedback Modal Overlay */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
      />
    </div>
  )
}

export default Dashboard
