import { create } from 'zustand'
import { API_BASE_URL } from '../config'

const useBookmarkStore = create((set, get) => ({
  // Bookmarks data
  bookmarks: [],
  loading: false,
  error: null,

  // Filters
  searchQuery: '',
  selectedTags: [],
  dateRange: { start: null, end: null },
  sortBy: 'date_added', // date_added, title, date_published

  // View mode
  viewMode: 'cards', // cards, list, timeline

  // Set bookmarks
  setBookmarks: (bookmarks) => set({ bookmarks }),

  // Set loading state
  setLoading: (loading) => set({ loading }),

  // Set error
  setError: (error) => set({ error }),

  // Search
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Tags
  toggleTag: (tag) => set((state) => {
    const selectedTags = state.selectedTags.includes(tag)
      ? state.selectedTags.filter(t => t !== tag)
      : [...state.selectedTags, tag]
    return { selectedTags }
  }),

  clearTags: () => set({ selectedTags: [] }),

  // Date range
  setDateRange: (start, end) => set({ dateRange: { start, end } }),

  clearDateRange: () => set({ dateRange: { start: null, end: null } }),

  // Sort
  setSortBy: (sortBy) => set({ sortBy }),

  // View mode
  setViewMode: (mode) => set({ viewMode: mode }),

  // Get filtered bookmarks
  getFilteredBookmarks: () => {
    const { bookmarks, searchQuery, selectedTags, dateRange, sortBy } = get()

    let filtered = [...bookmarks]

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(bookmark =>
        bookmark.title?.toLowerCase().includes(query) ||
        bookmark.description?.toLowerCase().includes(query) ||
        bookmark.url?.toLowerCase().includes(query) ||
        bookmark.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(bookmark =>
        selectedTags.some(tag => bookmark.tags?.includes(tag))
      )
    }

    // Filter by date range
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(bookmark => {
        const bookmarkDate = new Date(bookmark.created_at)
        if (dateRange.start && bookmarkDate < dateRange.start) return false
        if (dateRange.end && bookmarkDate > dateRange.end) return false
        return true
      })
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_added':
          return new Date(b.created_at) - new Date(a.created_at)
        case 'title':
          return (a.title || '').localeCompare(b.title || '')
        case 'date_published':
          return new Date(b.published_date || 0) - new Date(a.published_date || 0)
        default:
          return 0
      }
    })

    return filtered
  },

  // Fetch bookmarks from API
  fetchBookmarks: async () => {
    set({ loading: true, error: null })

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE_URL}/bookmarks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        // Try to get the actual error message from the response
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.message || errorData?.error || 'Failed to fetch bookmarks'
        throw new Error(errorMessage)
      }

      const data = await response.json()
      set({ bookmarks: data.bookmarks || [], loading: false, error: null })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  // Delete bookmark
  deleteBookmark: async (bookmarkId) => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(
        `${API_BASE_URL}/bookmarks/${bookmarkId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to delete bookmark')
      }

      // Remove from state
      set((state) => ({
        bookmarks: state.bookmarks.filter(b => b.id !== bookmarkId)
      }))
    } catch (error) {
      set({ error: error.message })
      throw error
    }
  }
}))

export default useBookmarkStore
