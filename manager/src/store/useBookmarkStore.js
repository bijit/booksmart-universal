import { create } from 'zustand'
import { API_BASE_URL } from '../config'

const useBookmarkStore = create((set, get) => ({
  // Bookmarks data
  bookmarks: [],
  loading: false,
  error: null,

  // Pagination
  hasMore: true,
  currentOffset: 0,
  pageSize: 100,

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
  setSearchQuery: async (query) => {
    set({ searchQuery: query })

    // If there's a search query, use semantic search API
    if (query.trim()) {
      const store = get()
      await store.performSearch(query)
    } else {
      // If search is cleared, reload all bookmarks
      const store = get()
      await store.fetchBookmarks()
    }
  },

  // Perform semantic search using the API
  performSearch: async (query) => {
    set({ loading: true, error: null })

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query,
          limit: 50,
          threshold: 0.3
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.message || errorData?.error || 'Search failed'
        throw new Error(errorMessage)
      }

      const data = await response.json()
      set({ bookmarks: data.results || [], loading: false, error: null })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  // Tags
  toggleTag: async (tag) => {
    const state = get()
    const selectedTags = state.selectedTags.includes(tag)
      ? state.selectedTags.filter(t => t !== tag)
      : [...state.selectedTags, tag]
    set({ selectedTags })
    // Refetch with new filter
    await state.fetchBookmarks()
  },

  clearTags: async () => {
    set({ selectedTags: [] })
    // Refetch without tag filter
    const state = get()
    await state.fetchBookmarks()
  },

  // Date range
  setDateRange: async (start, end) => {
    set({ dateRange: { start, end } })
    // Refetch with new filter
    const state = get()
    await state.fetchBookmarks()
  },

  clearDateRange: async () => {
    set({ dateRange: { start: null, end: null } })
    // Refetch without date filter
    const state = get()
    await state.fetchBookmarks()
  },

  // Sort
  setSortBy: (sortBy) => set({ sortBy }),

  // View mode
  setViewMode: (mode) => set({ viewMode: mode }),

  // Get filtered bookmarks
  getFilteredBookmarks: () => {
    const { bookmarks, sortBy } = get()

    let filtered = [...bookmarks]

    // Note: Search query, tags, and date filtering are handled by the API
    // This function only handles client-side sorting

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

  // Fetch bookmarks from API (reset pagination)
  fetchBookmarks: async () => {
    const { pageSize, selectedTags, dateRange } = get()
    set({ loading: true, error: null, currentOffset: 0 })

    try {
      const token = localStorage.getItem('authToken')

      // Build query parameters
      const params = new URLSearchParams({
        status: 'completed',
        limit: pageSize,
        offset: 0
      })

      // Add tag filtering
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','))
      }

      // Add date range filtering
      if (dateRange.start) {
        params.append('start_date', dateRange.start.toISOString())
      }
      if (dateRange.end) {
        params.append('end_date', dateRange.end.toISOString())
      }

      const response = await fetch(
        `${API_BASE_URL}/bookmarks?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        // Try to get the actual error message from the response
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.message || errorData?.error || 'Failed to fetch bookmarks'
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const bookmarks = data.bookmarks || []
      set({
        bookmarks,
        loading: false,
        error: null,
        currentOffset: bookmarks.length,
        hasMore: bookmarks.length >= pageSize
      })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  // Load more bookmarks (append to existing)
  loadMoreBookmarks: async () => {
    const { currentOffset, pageSize, selectedTags, dateRange, bookmarks: existingBookmarks } = get()
    set({ loading: true, error: null })

    try {
      const token = localStorage.getItem('authToken')

      // Build query parameters with same filters as initial fetch
      const params = new URLSearchParams({
        status: 'completed',
        limit: pageSize,
        offset: currentOffset
      })

      // Add tag filtering
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','))
      }

      // Add date range filtering
      if (dateRange.start) {
        params.append('start_date', dateRange.start.toISOString())
      }
      if (dateRange.end) {
        params.append('end_date', dateRange.end.toISOString())
      }

      const response = await fetch(
        `${API_BASE_URL}/bookmarks?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to load more bookmarks')
      }

      const data = await response.json()
      const newBookmarks = data.bookmarks || []
      set({
        bookmarks: [...existingBookmarks, ...newBookmarks],
        loading: false,
        error: null,
        currentOffset: currentOffset + newBookmarks.length,
        hasMore: newBookmarks.length >= pageSize
      })
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
