import { create } from 'zustand'
import { API_BASE_URL } from '../config'
import { isAuthError, handleAuthError } from '../utils/auth'

const useBookmarkStore = create((set, get) => {
  let searchTimeout = null;

  return {
  // Bookmarks data
  bookmarks: [],
  cachedBookmarks: [], // Cache of non-search results for instant filtering
  loading: false,
  isDeepSearching: false, // API search in progress
  error: null,
  aiAnswer: null,
  allFolders: [], // Full unique list of folder paths


  // Pagination
  currentPage: 1,
  pageSize: 50,
  totalBookmarks: 0,
  totalPages: 0,

  // Filters
  searchQuery: '',
  selectedTags: [],
  selectedFolder: null, // Full path string
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
    const state = get()
    const trimmedQuery = query.trim()
    set({ searchQuery: query })

    // If there's a search query, perform Instant Local Search first
    if (trimmedQuery) {
      // 1. Perform local keyword match on currently loaded bookmarks
      // Use cachedBookmarks if we were already searching, or the current bookmarks if we just started
      const sourceList = state.cachedBookmarks.length > 0 ? state.cachedBookmarks : state.bookmarks
      
      // If this is the first search character, save current bookmarks to cache
      if (state.cachedBookmarks.length === 0) {
        set({ cachedBookmarks: [...state.bookmarks] })
      }

      const queryLower = trimmedQuery.toLowerCase()
      const localMatches = sourceList.filter(b => 
        (b.title || '').toLowerCase().includes(queryLower) ||
        (b.description || '').toLowerCase().includes(queryLower) ||
        (b.notes || '').toLowerCase().includes(queryLower) ||
        (b.site_name || '').toLowerCase().includes(queryLower) ||
        (b.author || '').toLowerCase().includes(queryLower) ||
        (b.tags || []).some(t => t.toLowerCase().includes(queryLower))
      )

      // Show local results immediately
      set({ bookmarks: localMatches, totalBookmarks: localMatches.length })

      // 2. Trigger Deep Semantic Search (Debounced)
      if (searchTimeout) clearTimeout(searchTimeout)
      searchTimeout = setTimeout(async () => {
        await get().performSearch(trimmedQuery)
      }, 600) // 600ms debounce
    } else {
      // If search is cleared, cancel pending search and restore from cache
      if (searchTimeout) clearTimeout(searchTimeout)
      
      if (state.cachedBookmarks.length > 0) {
        set({ 
          bookmarks: state.cachedBookmarks, 
          cachedBookmarks: [], 
          isDeepSearching: false,
          aiAnswer: null
        })
      } else {
        await state.fetchBookmarks()
      }
    }
  },

  // Perform semantic search using the API
  performSearch: async (query) => {
    set({ isDeepSearching: true, error: null, aiAnswer: null })

    try {
      const { selectedTags, dateRange, selectedFolder } = get()
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query,
          limit: 20,
          scoreThreshold: 0.3,
          tags: selectedTags.length > 0 ? selectedTags : null,
          startDate: dateRange.start ? dateRange.start.toISOString() : null,
          endDate: dateRange.end ? dateRange.end.toISOString() : null,
          folderPath: selectedFolder
        })
      })


      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.message || errorData?.error || 'Search failed'
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const results = data.results || []
      const aiAnswer = data.answer || null

      // Reset pagination for search results (search doesn't support pagination)
      set({
        bookmarks: results,
        aiAnswer: aiAnswer,
        isDeepSearching: false,
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
      set({ error: error.message, isDeepSearching: false })
    }
  },

  // Tags
  toggleTag: async (tag) => {
    const state = get()
    const selectedTags = state.selectedTags.includes(tag)
      ? state.selectedTags.filter(t => t !== tag)
      : [...state.selectedTags, tag]
    set({ selectedTags })
    
    // Refetch with new filter (respect search if active)
    if (state.searchQuery.trim()) {
      await state.performSearch(state.searchQuery)
    } else {
      await state.fetchBookmarks()
    }
  },

  setSelectedTags: async (tags) => {
    const state = get()
    set({ selectedTags: tags })
    
    // Refetch with new filter (respect search if active)
    if (state.searchQuery.trim()) {
      await state.performSearch(state.searchQuery)
    } else {
      await state.fetchBookmarks()
    }
  },

  clearTags: async () => {
    set({ selectedTags: [] })
    
    // Refetch without tag filter (respect search if active)
    const state = get()
    if (state.searchQuery.trim()) {
      await state.performSearch(state.searchQuery)
    } else {
      await state.fetchBookmarks()
    }
  },

  // Date range
  setDateRange: async (start, end) => {
    set({ dateRange: { start, end } })
    
    // Refetch with new filter (respect search if active)
    const state = get()
    if (state.searchQuery.trim()) {
      await state.performSearch(state.searchQuery)
    } else {
      await state.fetchBookmarks()
    }
  },

  clearDateRange: async () => {
    set({ dateRange: { start: null, end: null } })
    
    // Refetch without date filter (respect search if active)
    const state = get()
    if (state.searchQuery.trim()) {
      await state.performSearch(state.searchQuery)
    } else {
      await state.fetchBookmarks()
    }
  },

  // Folders
  setSelectedFolder: async (folderPath) => {
    set({ selectedFolder: folderPath })
    
    // Refetch with new filter (respect search if active)
    const state = get()
    if (state.searchQuery.trim()) {
      await state.performSearch(state.searchQuery)
    } else {
      await state.fetchBookmarks()
    }
  },

  clearFolder: async () => {
    set({ selectedFolder: null })
    
    // Refetch without folder filter (respect search if active)
    const state = get()
    if (state.searchQuery.trim()) {
      await state.performSearch(state.searchQuery)
    } else {
      await state.fetchBookmarks()
    }
  },


  // Sort
  setSortBy: (sortBy) => set({ sortBy }),

  // View mode
  setViewMode: (mode) => set({ viewMode: mode }),

  // Get filtered bookmarks
  getFilteredBookmarks: () => {
    const { bookmarks, sortBy, searchQuery } = get()

    let filtered = [...bookmarks]

    // If we are in search mode, the API has already sorted by relevance score.
    // We should only apply client-side sorting if we are NOT searching.
    if (!searchQuery) {
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
    }

    return filtered
  },

  // Fetch bookmarks from API (page 1 by default)
  fetchBookmarks: async (page = 1) => {
    const { pageSize, selectedTags, dateRange, selectedFolder, searchQuery } = get()
    
    // If search is active, do not fetch standard bookmarks
    if (searchQuery.trim()) return;

    set({ loading: true, error: null, currentPage: page })

    try {
      const token = localStorage.getItem('authToken')

      // SPECIAL CASE: If tags or folder filter is active, fetch entire set via search API
      if (selectedTags.length > 0 || selectedFolder) {
        let endpoint = `${API_BASE_URL}/search/tags?limit=10000`;
        if (selectedTags.length > 0) {
           endpoint += `&tags=${selectedTags.join(',')}`;
        }
        if (selectedFolder) {
           // We might need to add folderPath to the search/tags endpoint, or use POST /api/search with empty query
           // Since GET /api/search/tags doesn't currently accept folder_path, we will use POST /api/search
           const response = await fetch(`${API_BASE_URL}/search`, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${token}`
             },
             body: JSON.stringify({
               query: " ", // Empty query for pure filter
               limit: 5000,
               searchType: 'semantic', // Fallback to semantic which just delegates to Qdrant filters if query is weak
               tags: selectedTags.length > 0 ? selectedTags : null,
               folderPath: selectedFolder
             })
           });

           if (!response.ok) throw new Error('Failed to fetch filtered bookmarks');
           const data = await response.json();
           
           // De-duplicate results by ID as a safety measure
           const rawResults = data.results || [];
           const uniqueResults = [];
           const seenIds = new Set();
           for (const item of rawResults) {
             if (!seenIds.has(item.id)) {
               seenIds.add(item.id);
               uniqueResults.push(item);
             }
           }
           
           set({
             bookmarks: uniqueResults,
             totalBookmarks: uniqueResults.length,
             totalPages: 1, // Single massive page
             loading: false
           });
           return;
        } else {
           // Just tags, use the GET endpoint
           const response = await fetch(endpoint, {
             headers: { 'Authorization': `Bearer ${token}` }
           });
           if (!response.ok) throw new Error('Failed to fetch filtered bookmarks');
           const data = await response.json();
           
           const rawResults = data.results || [];
           const uniqueResults = [];
           const seenIds = new Set();
           for (const item of rawResults) {
             if (!seenIds.has(item.id)) {
               seenIds.add(item.id);
               uniqueResults.push(item);
             }
           }
           
           set({
             bookmarks: uniqueResults,
             totalBookmarks: uniqueResults.length,
             totalPages: 1, // Single massive page
             loading: false
           });
           return;
        }
      }

      // STANDARD FETCH (No tags/folders)
      // Calculate offset from page number
      const offset = (page - 1) * pageSize

      // Build query parameters
      const params = new URLSearchParams({
        status: 'completed',
        limit: pageSize,
        offset: offset
      })

      // Add date range filtering
      if (dateRange.start) {
        params.append('start_date', dateRange.start.toISOString())
      }
      if (dateRange.end) {
        params.append('end_date', dateRange.end.toISOString())
      }

      // Add folder filtering
      if (selectedFolder) {
        params.append('folder_path', selectedFolder)
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

  // Fetch unique folder paths
  fetchFolders: async () => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE_URL}/bookmarks/folders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        set({ allFolders: data.folders || [] })
      }
    } catch (error) {
      console.error('Error fetching folders:', error)
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
  },

  // Update bookmark
  updateBookmark: async (bookmarkId, updates) => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(
        `${API_BASE_URL}/bookmarks/${bookmarkId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to update bookmark')
      }

      const { bookmark } = await response.json()

      // Update in state
      set((state) => ({
        bookmarks: state.bookmarks.map(b => b.id === bookmarkId ? { ...b, ...bookmark } : b)
      }))

      return bookmark
    } catch (error) {
      // Check if this is an authentication error
      if (isAuthError(error)) {
        handleAuthError()
        return
      }
      set({ error: error.message })
      throw error
    }
  },

  // Generate deep summary
  generateSummary: async (bookmarkId) => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(
        `${API_BASE_URL}/bookmarks/${bookmarkId}/summarize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to generate summary')
      }

      const { summary } = await response.json()

      // Update the bookmark in state with its new summary
      set((state) => ({
        bookmarks: state.bookmarks.map(b =>
          b.id === bookmarkId ? { ...b, detailed_summary: summary } : b
        )
      }))

      return summary
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthError()
        return
      }
      throw error
    }
  },


  // Fetch all unique folders
  fetchFolders: async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch(`${API_BASE_URL}/bookmarks/folders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        set({ allFolders: data.folders || [] })
      }
    } catch (error) {
      console.error('Failed to fetch unique folders:', error)
    }
  },
  
  // Research more on the web
  researchOnWeb: async (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    const { searchQuery, aiAnswer } = get()
    if (!searchQuery || !aiAnswer) return
    
    set({ loading: true })
    
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE_URL}/search/web-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: searchQuery,
          overview: aiAnswer.answer
        })
      })
      
      if (!response.ok) throw new Error('Failed to generate web query')
      
      const { refinedQuery } = await response.json()
      
      // Open Google Search with the refined query in a new tab
      window.open(`https://www.google.com/search?q=${encodeURIComponent(refinedQuery)}`, '_blank')
      
    } catch (error) {
      console.error('Research on web error:', error)
      // Fallback: search with original query
      window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank')
    } finally {
      set({ loading: false })
    }
  }
}})

export default useBookmarkStore
