import { useState } from 'react'
import { ChevronDown, ChevronRight, Tag } from 'lucide-react'
import BookmarkCard from './BookmarkCard'

function TagCloudView({ bookmarks }) {
  // Group bookmarks by ALL tags (a bookmark appears in every group it belongs to)
  const groups = bookmarks.reduce((acc, bookmark) => {
    const tags = bookmark.tags && bookmark.tags.length > 0
      ? bookmark.tags
      : ['Untagged']

    tags.forEach(tag => {
      if (!acc[tag]) {
        acc[tag] = []
      }
      acc[tag].push(bookmark)
    })
    return acc
  }, {})

  // Sort groups by count (descending), with 'Untagged' always last
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    if (a[0] === 'Untagged') return 1
    if (b[0] === 'Untagged') return -1
    return b[1].length - a[1].length
  })

  // Start with all groups expanded
  const [collapsed, setCollapsed] = useState({})

  const toggleGroup = (tag) => {
    setCollapsed(prev => ({ ...prev, [tag]: !prev[tag] }))
  }

  if (sortedGroups.length === 0) return null

  return (
    <div className="space-y-6">
      {sortedGroups.map(([tag, items]) => {
        const isCollapsed = collapsed[tag]

        return (
          <div key={tag} className="group">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(tag)}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-xl
                         bg-light-card dark:bg-dark-card
                         border border-light-border dark:border-dark-border
                         hover:border-accent dark:hover:border-accent-dark
                         transition-all duration-200 mb-3"
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5 text-accent dark:text-accent-dark flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-accent dark:text-accent-dark flex-shrink-0" />
              )}
              <Tag className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />
              <span className="font-semibold text-base">{tag}</span>
              <span className="ml-auto text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary
                              bg-light-bg dark:bg-dark-bg px-2.5 py-0.5 rounded-full">
                {items.length}
              </span>
            </button>

            {/* Group Cards */}
            {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pl-2 animate-in fade-in duration-200">
                {items.map(bookmark => (
                  <BookmarkCard key={bookmark.id} bookmark={bookmark} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default TagCloudView
