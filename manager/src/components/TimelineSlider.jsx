import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Calendar, X } from 'lucide-react'

function TimelineSlider({ bookmarks, dateRange, setDateRange, clearDateRange }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(null) // 'min' | 'max' | null

  // Compute date bounds from bookmark data
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (!bookmarks || bookmarks.length === 0) {
      const now = new Date()
      const monthAgo = new Date(now)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return { minDate: monthAgo, maxDate: now, totalDays: 30 }
    }

    const dates = bookmarks
      .map(b => new Date(b.created_at))
      .filter(d => !isNaN(d))
      .sort((a, b) => a - b)

    const min = dates[0]
    const max = dates[dates.length - 1]
    const days = Math.max(1, Math.round((max - min) / (1000 * 60 * 60 * 24)))

    return { minDate: min, maxDate: max, totalDays: days }
  }, [bookmarks])

  // Density histogram (bookmarks per bucket)
  const histogram = useMemo(() => {
    const bucketCount = 30
    const buckets = new Array(bucketCount).fill(0)
    const range = maxDate - minDate || 1

    bookmarks.forEach(b => {
      const d = new Date(b.created_at)
      if (isNaN(d)) return
      const idx = Math.min(
        bucketCount - 1,
        Math.floor(((d - minDate) / range) * bucketCount)
      )
      buckets[idx]++
    })

    const maxVal = Math.max(...buckets, 1)
    return buckets.map(v => v / maxVal)
  }, [bookmarks, minDate, maxDate])

  // Current selection as percentages (0-100)
  const selectionStart = dateRange.start
    ? Math.max(0, ((dateRange.start - minDate) / (maxDate - minDate || 1)) * 100)
    : 0
  const selectionEnd = dateRange.end
    ? Math.min(100, ((dateRange.end - minDate) / (maxDate - minDate || 1)) * 100)
    : 100

  // Convert percentage to date
  const percentToDate = useCallback((pct) => {
    const ms = minDate.getTime() + (pct / 100) * (maxDate.getTime() - minDate.getTime())
    return new Date(ms)
  }, [minDate, maxDate])

  // Format date for display
  const formatDate = (date) => {
    if (!date) return ''
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  }

  // Mouse/touch interaction
  const getPercent = useCallback((clientX) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
  }, [])

  const handlePointerDown = (handle) => (e) => {
    e.preventDefault()
    setDragging(handle)
  }

  useEffect(() => {
    if (!dragging) return

    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const pct = getPercent(clientX)
      const newDate = percentToDate(pct)

      if (dragging === 'min') {
        const end = dateRange.end || maxDate
        if (newDate < end) {
          setDateRange(newDate, end)
        }
      } else {
        const start = dateRange.start || minDate
        if (newDate > start) {
          setDateRange(start, newDate)
        }
      }
    }

    const handleUp = () => setDragging(null)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove)
    window.addEventListener('touchend', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [dragging, dateRange, minDate, maxDate, getPercent, percentToDate, setDateRange])

  const hasSelection = dateRange.start || dateRange.end

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
          <h3 className="font-medium text-sm">Timeline</h3>
        </div>
        {hasSelection && (
          <button
            onClick={clearDateRange}
            className="text-xs text-accent dark:text-accent-dark hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Histogram */}
      <div className="flex items-end gap-px h-8 mb-1 px-1">
        {histogram.map((height, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-colors duration-150"
            style={{
              height: `${Math.max(2, height * 100)}%`,
              backgroundColor: height > 0
                ? `hsl(220, 80%, ${65 - height * 25}%)`
                : 'transparent',
              opacity: (
                (i / histogram.length * 100) >= selectionStart &&
                (i / histogram.length * 100) <= selectionEnd
              ) ? 1 : 0.25
            }}
          />
        ))}
      </div>

      {/* Slider Track */}
      <div
        ref={trackRef}
        className="relative h-6 cursor-pointer select-none"
      >
        {/* Background track */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-light-border dark:bg-dark-border rounded-full" />

        {/* Active range */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-accent dark:bg-accent-dark rounded-full transition-none"
          style={{
            left: `${selectionStart}%`,
            width: `${selectionEnd - selectionStart}%`
          }}
        />

        {/* Min Handle */}
        <div
          onMouseDown={handlePointerDown('min')}
          onTouchStart={handlePointerDown('min')}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2
                      w-4 h-4 bg-white border-2 border-accent dark:border-accent-dark
                      rounded-full shadow-md cursor-grab
                      hover:scale-125 transition-transform
                      ${dragging === 'min' ? 'scale-125 cursor-grabbing' : ''}`}
          style={{ left: `${selectionStart}%` }}
        />

        {/* Max Handle */}
        <div
          onMouseDown={handlePointerDown('max')}
          onTouchStart={handlePointerDown('max')}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2
                      w-4 h-4 bg-white border-2 border-accent dark:border-accent-dark
                      rounded-full shadow-md cursor-grab
                      hover:scale-125 transition-transform
                      ${dragging === 'max' ? 'scale-125 cursor-grabbing' : ''}`}
          style={{ left: `${selectionEnd}%` }}
        />
      </div>

      {/* Date Labels */}
      <div className="flex justify-between mt-1">
        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
          {formatDate(dateRange.start || minDate)}
        </span>
        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
          {formatDate(dateRange.end || maxDate)}
        </span>
      </div>
    </div>
  )
}

export default TimelineSlider
