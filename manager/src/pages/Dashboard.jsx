import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import BookmarkCard from '../components/BookmarkCard'
import EmptyState from '../components/EmptyState'
import ImportBookmarks from '../components/ImportBookmarks'
import Pagination from '../components/Pagination'
import useBookmarkStore from '../store/useBookmarkStore'

function Dashboard({ darkMode, toggleDarkMode, onLogout }) {
  const [showImport, setShowImport] = useState(false)
  const {
    loading,
    error,
    fetchBookmarks,
    goToPage,
    getFilteredBookmarks,
    viewMode,
    dateRange,
    selectedTags,
    sortBy,
    currentPage,
    totalPages
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
          <div className="w-full max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
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
                      <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2 sm:gap-3">
                        <span className="text-accent dark:text-accent-dark whitespace-nowrap">{date}</span>
                        <div className="flex-1 h-px bg-light-border dark:bg-dark-border min-w-0"></div>
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {bookmarks.map(bookmark => (
                          <BookmarkCard key={bookmark.id} bookmark={bookmark} />
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
