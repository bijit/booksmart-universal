import { useState, useEffect, useRef } from 'react'
import { Search, Moon, Sun, LogOut, Grid, List, Clock, Layers, Upload, X, Sparkles, Zap, Brain } from 'lucide-react'
import useBookmarkStore from '../store/useBookmarkStore'

function Header({ darkMode, toggleDarkMode, onLogout, onOpenImport }) {
  const { searchQuery, setSearchQuery, viewMode, setViewMode, deepSearchEnabled, setDeepSearchEnabled, searchMode, setSearchMode } = useBookmarkStore()
  const [searchFocused, setSearchFocused] = useState(false)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  const searchTimeoutRef = useRef(null)
  const userName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'User'

  // Debounce search to avoid excessive API calls
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(localSearchQuery)
    }, 500) // 500ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [localSearchQuery, setSearchQuery])

  return (
    <header className="sticky top-0 z-50 bg-light-card dark:bg-dark-card border-b border-light-border dark:border-dark-border">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-4 h-16">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <div className="text-xl sm:text-2xl font-bold whitespace-nowrap">
              <span className="text-accent dark:text-accent-dark">Book</span>
              <span>Smart</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl min-w-0 mx-2 sm:mx-4 lg:mx-8">
            <div className="flex items-center gap-2">
              <div className={`relative flex-1 transition-all duration-200 ${searchFocused ? 'transform scale-105' : ''}`}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search bookmarks..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className="input pl-10 pr-10 w-full"
                />
                {localSearchQuery && (
                  <button
                    onClick={() => setLocalSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Unified 3-state Search Mode Segmented Control */}
              <div className="flex items-center bg-light-bg dark:bg-dark-bg rounded-xl p-1 border border-light-border dark:border-dark-border gap-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setSearchMode('instant')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    searchMode === 'instant'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  title="Instant keyword search (Fast local filter)"
                >
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline">Instant</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSearchMode('semantic');
                    setDeepSearchEnabled(false);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    searchMode === 'semantic' && !deepSearchEnabled
                      ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm'
                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  title="Semantic search (AI concept matching)"
                >
                  <Brain className="w-4 h-4" />
                  <span className="hidden sm:inline">Semantic</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSearchMode('semantic');
                    setDeepSearchEnabled(true);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    searchMode === 'semantic' && deepSearchEnabled
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  title="AI Overview search (Summarizes matching concepts)"
                >
                  <Sparkles className={`w-4 h-4 ${deepSearchEnabled && searchMode === 'semantic' ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline">AI Overview</span>
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* View Mode Toggle */}
            <div className="hidden md:flex items-center gap-1 bg-light-bg dark:bg-dark-bg rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-accent text-white'
                    : 'hover:bg-light-card dark:hover:bg-dark-card'
                }`}
                title="Cards View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-accent text-white'
                    : 'hover:bg-light-card dark:hover:bg-dark-card'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-accent text-white'
                    : 'hover:bg-light-card dark:hover:bg-dark-card'
                }`}
                title="Timeline View"
              >
                <Clock className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grouped'
                    ? 'bg-accent text-white'
                    : 'hover:bg-light-card dark:hover:bg-dark-card'
                }`}
                title="Grouped by Tag"
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>

            {/* Import Button */}
            <button
              onClick={onOpenImport}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg transition-colors text-sm font-medium"
              title="Import Bookmarks"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>

            {/* User Name */}
            <div className="hidden sm:flex items-center px-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {userName}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
              title={darkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="p-2 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
