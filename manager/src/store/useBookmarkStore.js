import { create } from 'zustand'
import { API_BASE_URL } from '../config'
import { isAuthError, handleAuthError } from '../utils/auth'

const useBookmarkStore = create((set, get) => ({
  // Bookmarks data
  bookmarks: [],
  loading: false,
  error: null,

  // Pagination
  currentPage: 1,
  pageSize: 50,
  totalBookmarks: 0,
  totalPages: 0,

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
      const results = data.results || []

      // Reset pagination for search results (search doesn't support pagination)
      set({
        bookmarks: results,
        loading: false,
        error: null,
        currentPage: 1,
        totalPages: 0, // 0 indicates search mode (pagination hidden)
        totalBookmarks: results.length
      })
    } catch (error) {
      // Check if this is an authentication error
      if (isAuthError(error)) {
        handleAuthError()
        return
      }
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

  // Fetch bookmarks from API (page 1 by default)
  fetchBookmarks: async (page = 1) => {
    const { pageSize, selectedTags, dateRange } = get()
    set({ loading: true, error: null, currentPage: page })

    try {
      const token = localStorage.getItem('authToken')

      // Calculate offset from page number
      const offset = (page - 1) * pageSize

      // Build query parameters
      const params = new URLSearchParams({
        status: 'completed',
        limit: pageSize,
        offset: offset
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
      const pagination = data.pagination || {}

      set({
        bookmarks,
        loading: false,
        error: null,
        currentPage: page,
        totalBookmarks: pagination.total || 0,
        totalPages: pagination.totalPages || 0
      })
    } catch (error) {
      // Check if this is an authentication error
      if (isAuthError(error)) {
        handleAuthError()
        return
      }
      set({ error: error.message, loading: false })
    }
  },

  // Go to specific page
  goToPage: async (page) => {
    const state = get()
    await state.fetchBookmarks(page)
  },

  // Go to next page
  nextPage: async () => {
    const { currentPage, totalPages } = get()
    if (currentPage < totalPages) {
      const state = get()
      await state.fetchBookmarks(currentPage + 1)
    }
  },

  // Go to previous page
  previousPage: async () => {
    const { currentPage } = get()
    if (currentPage > 1) {
      const state = get()
      await state.fetchBookmarks(currentPage - 1)
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
      // Check if this is an authentication error
      if (isAuthError(error)) {
        handleAuthError()
        return
      }
      set({ error: error.message })
      throw error
    }
  }
}))

export default useBookmarkStore
