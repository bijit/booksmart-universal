import { useState } from 'react'
import { ExternalLink, Trash2, Edit2, Calendar, Clock, Sparkles, ChevronDown, ChevronUp, CheckCircle2, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import useBookmarkStore from '../store/useBookmarkStore'
import EditBookmarkModal from './EditBookmarkModal'

function BookmarkCard({ bookmark, layoutMode = 'gallery' }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [showAllImages, setShowAllImages] = useState(false)
  const { deleteBookmark, toggleTag, generateSummary } = useBookmarkStore()

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bookmark?')) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteBookmark(bookmark.id)
    } catch (error) {
      alert('Failed to delete bookmark: ' + error.message)
      setIsDeleting(false)
    }
  }

  const handleTagClick = (tag) => {
    toggleTag(tag)
  }

  const handleSummarize = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isSummarizing) return

    setIsSummarizing(true)
    try {
      await generateSummary(bookmark.id)
      setShowSummary(true)
    } catch (error) {
      console.error('Summarization failed:', error)
      alert('Summarization failed: ' + error.message)
    } finally {
      setIsSummarizing(false)
    }
  }

  // Generate favicon URL from bookmark URL (same as extension logic)
  const getFaviconUrl = (url) => {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    } catch (error) {
      return null
    }
  }

  const faviconUrl = bookmark.favicon_url || getFaviconUrl(bookmark.url)

  const isSearchResult = !!bookmark.score
  const scoreIntensity = bookmark.score ? Math.floor(bookmark.score * 10) : 0
  
  const getScoreColor = () => {
    if (scoreIntensity >= 8) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
    if (scoreIntensity >= 5) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
  }

  const getDocType = () => {
    const url = bookmark.url?.toLowerCase() || ''
    if (url.endsWith('.pdf') || bookmark.extraction_method === 'document-service' && bookmark.method === 'pdf-parse') return 'PDF'
    if (url.endsWith('.docx') || bookmark.extraction_method === 'document-service' && bookmark.method === 'mammoth') return 'DOCX'
    return null
  }

  const docType = getDocType()

  return (
    <div className={`card group relative flex flex-col overflow-hidden ${isDeleting ? 'opacity-50 pointer-events-none' : ''} ${
      layoutMode === 'gallery' ? 'h-[580px]' : ''
    } ${
      isSearchResult 
        ? 'border-accent/30 dark:border-accent-dark/30 shadow-sm shadow-accent/5' 
        : ''
    }`}>
      {/* Cover Image */}
      {bookmark.cover_image && (
        <div className={`w-full overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-800 border-b border-light-border dark:border-dark-border ${
          layoutMode === 'pinterest' ? 'min-h-[120px]' : 'h-48'
        }`}>
          <img 
            src={bookmark.cover_image} 
            alt={bookmark.title || 'Cover image'} 
            className={`w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              layoutMode === 'pinterest' ? 'h-auto' : 'h-full'
            }`}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Processing Status Badge */}
      {bookmark.processing_status && bookmark.processing_status !== 'completed' && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-500/90 text-white text-[10px] font-bold shadow-sm backdrop-blur-sm animate-pulse">
          <Clock className="w-3 h-3" />
          <span>{bookmark.processing_status === 'pending' ? 'PENDING' : 'PROCESSING...'}</span>
        </div>
      )}

      {/* Document Type Badge */}
      {docType && (
        <div className={`absolute ${bookmark.processing_status && bookmark.processing_status !== 'completed' ? 'top-10' : 'top-2'} left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-sm border ${
          docType === 'PDF' 
            ? 'bg-red-500/90 text-white border-red-400' 
            : 'bg-blue-500/90 text-white border-blue-400'
        }`}>
          <FileText className="w-3 h-3" />
          <span>{docType}</span>
        </div>
      )}
      
      <div className={`p-5 flex-1 flex flex-col min-h-0 ${isSearchResult ? 'bg-accent/5 dark:bg-accent-dark/5' : ''} ${bookmark.cover_image ? 'rounded-b-lg' : 'rounded-lg'}`}>
        {/* Header - FIXED */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-shrink-0">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Favicon */}
            {faviconUrl ? (
              <img
                src={faviconUrl}
                alt=""
                className="w-5 h-5 mt-1 flex-shrink-0 rounded"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <div className="w-5 h-5 mt-1 flex-shrink-0 bg-light-border dark:bg-dark-border rounded flex items-center justify-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <ExternalLink className="w-3 h-3" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold line-clamp-2">
                {bookmark.title || 'Untitled'}
              </h3>
              {(bookmark.author || bookmark.site_name) && (
                <div className="flex items-center gap-2 mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  {bookmark.author && <span className="truncate">By {bookmark.author}</span>}
                  {bookmark.author && bookmark.site_name && <span>•</span>}
                  {bookmark.site_name && <span className="truncate">{bookmark.site_name}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
              title="Open bookmark"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={handleSummarize}
              disabled={isSummarizing}
              className={`p-1.5 rounded transition-colors ${
                bookmark.detailed_summary 
                  ? 'text-accent dark:text-accent-dark hover:bg-accent/10' 
                  : 'hover:bg-light-bg dark:hover:bg-dark-bg'
              } ${isSummarizing ? 'animate-pulse' : ''}`}
              title={bookmark.detailed_summary ? "View/Refresh Summary" : "Generate Deep Summary"}
            >
              <Sparkles className={`w-4 h-4 ${isSummarizing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
              title="Edit bookmark"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors"
              title="Delete bookmark"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal */}
        {isEditing && (
          <EditBookmarkModal
            bookmark={bookmark}
            onClose={() => setIsEditing(false)}
          />
        )}

        {/* SCROLLABLE CONTENT SECTION */}
        <div className="flex-1 overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 hover:scrollbar-thumb-gray-300 dark:hover:scrollbar-thumb-gray-700">
          {/* Description */}
          {bookmark.description && (
            <div className="mb-4 text-light-text-secondary dark:text-dark-text-secondary">
              <p className={isDescriptionExpanded ? '' : 'line-clamp-4'}>
                {bookmark.description}
              </p>
              {bookmark.description.length > 200 && (
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDescriptionExpanded(!isDescriptionExpanded);
                  }}
                  className="text-xs text-accent dark:text-accent-dark hover:underline mt-1"
                >
                  {isDescriptionExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* Notes Section */}
          {bookmark.notes && (
            <div className="mb-4 p-3 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200/50 dark:border-yellow-800/30 rounded-lg">
              <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-700/70 dark:text-yellow-500/70 mb-1 flex items-center gap-1">
                <Edit2 className="w-2.5 h-2.5" />
                My Notes
              </p>
              <p className="text-sm text-light-text dark:text-dark-text whitespace-pre-wrap">
                {bookmark.notes}
              </p>
            </div>
          )}

          {/* Extracted Images Gallery */}
          {bookmark.extracted_images && bookmark.extracted_images.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">Visual Content</p>
              <div className="flex flex-wrap gap-2">
                {bookmark.extracted_images.slice(0, showAllImages ? undefined : 4).map((imgUrl, idx) => (
                  <div 
                    key={idx} 
                    className="group/img w-14 h-14 rounded-lg overflow-hidden border border-light-border dark:border-dark-border bg-gray-50 dark:bg-gray-900 cursor-zoom-in relative"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(imgUrl, '_blank');
                    }}
                  >
                    <img 
                      src={imgUrl} 
                      alt={`Extracted visual ${idx+1}`} 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110"
                      onError={(e) => e.target.parentElement.style.display = 'none'}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deep Summary Display */}
          {bookmark.detailed_summary && (
            <div className="mb-4 bg-accent/5 dark:bg-accent-dark/5 border border-accent/10 dark:border-accent-dark/10 rounded-lg overflow-hidden">
              <button 
                onClick={() => setShowSummary(!showSummary)}
                className="w-full flex items-center justify-between p-3 text-sm font-medium text-accent dark:text-accent-dark hover:bg-accent/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Deep Summary</span>
                </div>
                {showSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {showSummary && (
                <div className="p-3 pt-0 text-sm space-y-3">
                  <div>
                    <p className="font-semibold text-xs uppercase tracking-wider opacity-60 mb-1">TL;DR</p>
                    <p className="">{bookmark.detailed_summary.tldr}</p>
                  </div>
                  
                  <div>
                    <p className="font-semibold text-xs uppercase tracking-wider opacity-60 mb-1">Key Takeaways</p>
                    <ul className="space-y-1">
                      {bookmark.detailed_summary.key_takeaways.map((point, i) => (
                        <li key={i} className="flex gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bookmark.tags.map((tag, index) => (
                <span
                  key={index}
                  onClick={() => handleTagClick(tag)}
                  className="tag"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer - FIXED */}
        <div className="mt-auto pt-4 border-t border-light-border dark:border-dark-border flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
            <div className="flex items-center gap-4">
              {bookmark.created_at && (
                <div className="flex items-center gap-1" title={new Date(bookmark.created_at).toLocaleString()}>
                  <Clock className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(bookmark.created_at), { addSuffix: true })}</span>
                </div>
              )}
              {bookmark.score && (
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[11px] border transition-all ${getScoreColor()}`}>
                  <Sparkles className="w-3 h-3" />
                  <span>{(bookmark.score * 100).toFixed(0)}% Match</span>
                </div>
              )}
            </div>
          </div>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent dark:text-accent-dark hover:underline line-clamp-1 block"
          >
            {bookmark.url}
          </a>
        </div>
      </div>
    </div>
  )
}

export default BookmarkCard
