import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import BookmarkCard from '../components/BookmarkCard'
import EmptyState from '../components/EmptyState'
import ImportBookmarks from '../components/ImportBookmarks'
import useBookmarkStore from '../store/useBookmarkStore'

function Dashboard({ darkMode, toggleDarkMode, onLogout }) {
  const [showImport, setShowImport] = useState(false)
  const {
    loading,
    error,
    fetchBookmarks,
    getFilteredBookmarks,
    viewMode,
    dateRange,
    selectedTags,
    sortBy
  } = useBookmarkStore()

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
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6">
            {/* Loading State */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBookmarks.map(bookmark => (
                  <BookmarkCard key={bookmark.id} bookmark={bookmark} />
                ))}
              </div>
            )}

            {/* List View */}
            {!loading && filteredBookmarks.length > 0 && viewMode === 'list' && (
              <div className="space-y-4">
                {filteredBookmarks.map(bookmark => (
                  <BookmarkCard key={bookmark.id} bookmark={bookmark} />
                ))}
              </div>
            )}

            {/* Timeline View */}
            {!loading && filteredBookmarks.length > 0 && viewMode === 'timeline' && (
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
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
                      <span className="text-accent dark:text-accent-dark">{date}</span>
                      <div className="flex-1 h-px bg-light-border dark:bg-dark-border"></div>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {bookmarks.map(bookmark => (
                        <BookmarkCard key={bookmark.id} bookmark={bookmark} />
                      ))}
                    </div>
                  </div>
                ))}
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
    </div>
  )
}

export default Dashboard
