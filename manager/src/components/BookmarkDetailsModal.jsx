import { useState, useEffect } from 'react'
import { X, ExternalLink, Sparkles, Clock, Calendar, CheckCircle2, Save, FileText, Tag } from 'lucide-react'
import useBookmarkStore from '../store/useBookmarkStore'

function BookmarkDetailsModal({ bookmark, onClose }) {
  const { updateBookmark } = useBookmarkStore()
  const [notes, setNotes] = useState(bookmark.notes || '')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Auto-clear success state
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccess])

  const handleSaveNotes = async () => {
    setIsSavingNotes(true)
    try {
      await updateBookmark(bookmark.id, { notes })
      setSaveSuccess(true)
    } catch (err) {
      alert('Failed to save notes: ' + err.message)
    } finally {
      setIsSavingNotes(false)
    }
  }

  // Generate favicon URL
  const getFaviconUrl = (url) => {
    try {
      const urlObj = new URL(url)
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
    } catch {
      return null
    }
  }

  const faviconUrl = bookmark.favicon_url || getFaviconUrl(bookmark.url)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl h-[85vh] bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden animate-slideUp">
        {/* Cover Image Header */}
        {bookmark.cover_image && (
          <div className="w-full h-40 flex-shrink-0 relative overflow-hidden bg-gray-100 dark:bg-gray-800 border-b border-gray-150 dark:border-gray-800">
            <img 
              src={bookmark.cover_image} 
              alt="" 
              className="w-full h-full object-cover"
              onError={(e) => e.target.parentNode.style.display = 'none'}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          </div>
        )}

        {/* Header Block */}
        <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex-shrink-0 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {faviconUrl ? (
              <img src={faviconUrl} alt="" className="w-6 h-6 mt-1 flex-shrink-0 rounded" />
            ) : (
              <ExternalLink className="w-6 h-6 mt-1 text-gray-400 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                {bookmark.title || 'Untitled'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                {bookmark.site_name && <span className="font-semibold text-accent dark:text-accent-dark">{bookmark.site_name}</span>}
                {bookmark.author && <span>By {bookmark.author}</span>}
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(bookmark.created_at).toLocaleDateString()}
                </span>
                {bookmark.content_type && (
                  <span className="px-2 py-0.5 rounded-full bg-light-bg dark:bg-dark-bg text-[10px] font-bold border border-light-border dark:border-dark-border capitalize">
                    {bookmark.content_type}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Tags */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bookmark.tags.map((tag, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-light-bg dark:bg-dark-bg text-gray-600 dark:text-gray-300 border border-light-border dark:border-dark-border">
                  <Tag className="w-3 h-3 text-accent" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Grid Layout for details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Column: AI Deep Summary & Description */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Description */}
              {bookmark.description && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Description</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-light-bg/30 dark:bg-dark-bg/30 p-4 border border-light-border dark:border-dark-border rounded-2xl">
                    {bookmark.description}
                  </p>
                </div>
              )}

              {/* Deep Summary Section */}
              {bookmark.detailed_summary ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                    AI Deep Summary
                  </h3>

                  <div className="p-5 bg-accent/5 dark:bg-accent-dark/5 border border-accent/15 dark:border-accent-dark/15 rounded-3xl space-y-4">
                    <div>
                      <p className="font-bold text-[10px] uppercase tracking-wider opacity-60 mb-1">TL;DR (Too Long; Didn't Read)</p>
                      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{bookmark.detailed_summary.tldr}</p>
                    </div>
                    
                    <div>
                      <p className="font-bold text-[10px] uppercase tracking-wider opacity-60 mb-2">Key Takeaways</p>
                      <ul className="space-y-2">
                        {bookmark.detailed_summary.key_takeaways.map((point, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-750 dark:text-gray-250 leading-relaxed">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 rounded-3xl text-center space-y-2">
                  <Sparkles className="w-6 h-6 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">No AI Deep Summary has been generated yet for this bookmark.</p>
                </div>
              )}

              {/* Extracted Text Raw Section */}
              {bookmark.extracted_text && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    Extracted Text Content
                  </h3>
                  <div className="h-64 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-2xl text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed select-text">
                    {bookmark.extracted_text}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Sidebar (Notes & Links) */}
            <div className="space-y-6">
              
              {/* Personal Notes */}
              <div className="space-y-2 flex flex-col h-full min-h-[300px]">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">My Notes</h3>
                <div className="flex-1 flex flex-col bg-yellow-50/20 dark:bg-yellow-950/10 border border-yellow-200/40 dark:border-yellow-900/20 rounded-3xl p-4 space-y-3">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Write your personal thoughts, notes, or highlights about this resource..."
                    className="flex-1 bg-transparent resize-none outline-none text-xs text-gray-850 dark:text-gray-150 leading-relaxed focus:ring-0"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-yellow-200/30 dark:border-yellow-900/10">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold">
                      {notes.length} characters
                    </span>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes || notes === (bookmark.notes || '')}
                      className="px-3.5 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-xl text-[11px] font-bold flex items-center gap-1 disabled:opacity-50 transition-all shadow-sm"
                    >
                      <Save className="w-3 h-3" />
                      <span>{isSavingNotes ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Notes'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Resource Links info */}
              <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-3xl border border-gray-150 dark:border-gray-800 text-xs space-y-2">
                <p className="font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[10px]">Reference Link</p>
                <a 
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline flex items-center gap-1 truncate font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{bookmark.url}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookmarkDetailsModal
