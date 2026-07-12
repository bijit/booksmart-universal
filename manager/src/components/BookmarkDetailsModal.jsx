import { useState, useEffect } from 'react'
import { X, ExternalLink, Sparkles, Clock, Calendar, CheckCircle2, Save, FileText, Tag } from 'lucide-react'
import useBookmarkStore from '../store/useBookmarkStore'

function BookmarkDetailsModal({ bookmark, onClose }) {
  const { updateBookmark, generateSummary } = useBookmarkStore()
  const [currentBookmark, setCurrentBookmark] = useState(bookmark)
  const [notes, setNotes] = useState(bookmark.notes || '')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)

  // Sync prop changes to local state
  useEffect(() => {
    setCurrentBookmark(bookmark)
    setNotes(bookmark.notes || '')
  }, [bookmark])

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
      await updateBookmark(currentBookmark.id, { notes })
      setSaveSuccess(true)
      setCurrentBookmark(prev => ({ ...prev, notes }))
    } catch (err) {
      alert('Failed to save notes: ' + err.message)
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleSummarize = async () => {
    if (isSummarizing) return
    setIsSummarizing(true)
    try {
      const summary = await generateSummary(currentBookmark.id)
      if (summary) {
        setCurrentBookmark(prev => ({
          ...prev,
          detailed_summary: summary
        }))
      }
    } catch (err) {
      alert('Summarization failed: ' + err.message)
    } finally {
      setIsSummarizing(false)
    }
  }

  // Extract YouTube video ID
  const getYouTubeId = (url) => {
    if (!url) return null
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? match[2] : null
  }

  // Detect Media Types
  const isAudioFile = (url) => {
    if (!url) return false
    const cleanUrl = url.toLowerCase().split('?')[0]
    return cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.m4a')
  }

  const isVideoFile = (url) => {
    if (!url) return false
    const cleanUrl = url.toLowerCase().split('?')[0]
    return cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.ogg')
  }

  const isPdfFile = (url) => {
    if (!url) return false
    const cleanUrl = url.toLowerCase().split('?')[0]
    return cleanUrl.endsWith('.pdf')
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

  const faviconUrl = currentBookmark.favicon_url || getFaviconUrl(currentBookmark.url)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl h-[85vh] bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden animate-slideUp">
        {/* Cover Image Header */}
        {currentBookmark.cover_image && (
          <div className="w-full h-40 flex-shrink-0 relative overflow-hidden bg-gray-100 dark:bg-gray-800 border-b border-gray-150 dark:border-gray-800">
            <img 
              src={currentBookmark.cover_image} 
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
                {currentBookmark.title || 'Untitled'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                {currentBookmark.site_name && <span className="font-semibold text-accent dark:text-accent-dark">{currentBookmark.site_name}</span>}
                {currentBookmark.author && <span>By {currentBookmark.author}</span>}
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(currentBookmark.created_at).toLocaleDateString()}
                </span>
                {currentBookmark.content_type && (
                  <span className="px-2 py-0.5 rounded-full bg-light-bg dark:bg-dark-bg text-[10px] font-bold border border-light-border dark:border-dark-border capitalize">
                    {currentBookmark.content_type}
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
          {currentBookmark.tags && currentBookmark.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentBookmark.tags.map((tag, idx) => (
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
              
              {/* Embedded Player/Viewer Preview */}
              {(() => {
                const youtubeId = getYouTubeId(currentBookmark.url);
                if (youtubeId) {
                  return (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Video Preview</h3>
                      <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
                        <iframe
                          src={`https://www.youtube.com/embed/${youtubeId}`}
                          title="YouTube video player"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full"
                        ></iframe>
                      </div>
                    </div>
                  );
                }

                if (isVideoFile(currentBookmark.url)) {
                  return (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Video Preview</h3>
                      <video
                        src={currentBookmark.url}
                        controls
                        className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm max-h-[360px]"
                      ></video>
                    </div>
                  );
                }

                if (isAudioFile(currentBookmark.url) || currentBookmark.content_type === 'audio') {
                  return (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Audio Preview</h3>
                      <audio
                        src={currentBookmark.url}
                        controls
                        className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm bg-gray-50 dark:bg-gray-850 p-2"
                      ></audio>
                    </div>
                  );
                }

                if (isPdfFile(currentBookmark.url)) {
                  return (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Document Preview</h3>
                      <div className="w-full h-96 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm bg-gray-50 dark:bg-gray-950">
                        <iframe
                          src={`https://docs.google.com/viewer?url=${encodeURIComponent(currentBookmark.url)}&embedded=true`}
                          className="w-full h-full border-0"
                          title="PDF Document Viewer"
                        ></iframe>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Description */}
              {currentBookmark.description && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Description</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-light-bg/30 dark:bg-dark-bg/30 p-4 border border-light-border dark:border-dark-border rounded-2xl">
                    {currentBookmark.description}
                  </p>
                </div>
              )}

              {/* Deep Summary Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                    AI Deep Summary
                  </h3>
                  {currentBookmark.detailed_summary && (
                    <button
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                      className="px-3 py-1 text-[11px] font-bold text-accent dark:text-accent-dark border border-accent/20 hover:bg-accent/5 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                      <span>{isSummarizing ? 'Generating...' : 'Regenerate'}</span>
                    </button>
                  )}
                </div>

                {currentBookmark.detailed_summary ? (
                  <div className="p-5 bg-accent/5 dark:bg-accent-dark/5 border border-accent/15 dark:border-accent-dark/15 rounded-3xl space-y-4">
                    <div>
                      <p className="font-bold text-[10px] uppercase tracking-wider opacity-60 mb-1">TL;DR (Too Long; Didn't Read)</p>
                      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{currentBookmark.detailed_summary.tldr}</p>
                    </div>
                    
                    <div>
                      <p className="font-bold text-[10px] uppercase tracking-wider opacity-60 mb-2">Key Takeaways</p>
                      <ul className="space-y-2">
                        {currentBookmark.detailed_summary.key_takeaways.map((point, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-750 dark:text-gray-250 leading-relaxed">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 rounded-3xl text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto text-accent">
                      <Sparkles className={`w-6 h-6 ${isSummarizing ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-250">No AI summary generated</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Generate a comprehensive deep summary and key bullet takeaways using Gemini.</p>
                    </div>
                    <button
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                      className="px-6 py-2 bg-accent hover:bg-accent-dark text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm flex items-center gap-1.5 mx-auto"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                      <span>{isSummarizing ? 'Running AI Engine...' : 'Generate AI Deep Summary'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Extracted Text Raw Section */}
              {currentBookmark.extracted_text && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    Extracted Text Content
                  </h3>
                  <div className="h-64 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-2xl text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed select-text">
                    {currentBookmark.extracted_text}
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
                      disabled={isSavingNotes || notes === (currentBookmark.notes || '')}
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
                  href={currentBookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline flex items-center gap-1 truncate font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{currentBookmark.url}</span>
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
