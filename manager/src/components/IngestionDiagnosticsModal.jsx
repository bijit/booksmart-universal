import { useState, useEffect } from 'react'
import { X, RefreshCw, AlertCircle, CheckCircle, Activity, Hourglass, Cpu, Link } from 'lucide-react'

function IngestionDiagnosticsModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [triggeringWorker, setTriggeringWorker] = useState(false)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('authToken')
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
      
      const response = await fetch(`${baseUrl}/debug/bookmark-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to retrieve ingestion metrics')
      }
      
      const json = await response.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const triggerWorkerSync = async () => {
    setTriggeringWorker(true)
    try {
      const token = localStorage.getItem('authToken')
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
      
      // Post an empty bookmark payload which kicks off immediate processing cycles
      await fetch(`${baseUrl}/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url: 'https://ping-worker.internal', title: 'Worker Ping' })
      })
      
      // Wait a moment and refresh stats
      setTimeout(fetchStats, 1000)
    } catch (e) {
      console.warn('Ping failed:', e.message)
    } finally {
      setTriggeringWorker(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchStats()
    }
  }, [isOpen])

  if (!isOpen) return null

  // Calculate backoff timer display
  const getBackoffTimer = (untilStr) => {
    if (!untilStr) return null
    const until = new Date(untilStr).getTime()
    const diff = until - Date.now()
    if (diff <= 0) return 'Expiring...'
    const sec = Math.ceil(diff / 1000)
    if (sec > 60) {
      return `${Math.floor(sec / 60)}m ${sec % 60}s`
    }
    return `${sec}s`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-150 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ingestion & Worker Diagnostics</h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchStats}
              disabled={loading}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* Queue Status Grid */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Queue Status</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800/80">
                    <span className="text-2xl font-black text-gray-900 dark:text-white">{data.stats.pending}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-1">Pending Ingestion</p>
                  </div>
                  <div className="p-4 bg-blue-50/40 dark:bg-blue-950/10 rounded-2xl border border-blue-100/50 dark:border-blue-950/30">
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{data.stats.processing}</span>
                    <p className="text-xs text-blue-500 dark:text-blue-400 font-semibold mt-1">Processing</p>
                  </div>
                  <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-950/30">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{data.stats.completed}</span>
                    <p className="text-xs text-emerald-500 dark:text-emerald-400 font-semibold mt-1">Success</p>
                  </div>
                  <div className="p-4 bg-rose-50/40 dark:bg-rose-950/10 rounded-2xl border border-rose-100/50 dark:border-rose-950/30">
                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{data.stats.failed}</span>
                    <p className="text-xs text-rose-500 dark:text-rose-400 font-semibold mt-1">Failed</p>
                  </div>
                </div>
              </div>

              {/* Worker Engine Status */}
              {data.workerHealth && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Worker Engine</h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800/80 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200/55 dark:border-gray-800/60">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${data.workerHealth.workerRunning ? 'bg-emerald-100/60 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {data.workerHealth.workerRunning ? 'Active Engine Listening' : 'Inactive Engine'}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] bg-gray-200/60 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded font-bold">
                              Concurrency limit: {data.workerHealth.concurrencyLimit}
                            </span>
                            {data.workerHealth.chunkingEnabled && (
                              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">
                                Embedding Chunking
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={triggerWorkerSync}
                        disabled={triggeringWorker}
                        className="self-start sm:self-center px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        {triggeringWorker ? 'Triggering...' : 'Trigger Diagnostics Run'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Worker States */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400 font-semibold">Crawl Ingestion Processing:</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${data.workerHealth.isProcessing ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                            {data.workerHealth.isProcessing ? 'Active' : 'Idle'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400 font-semibold">Lazy Scraping Worker:</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${data.workerHealth.isLazyScraping ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                            {data.workerHealth.isLazyScraping ? 'Active' : 'Idle'}
                          </span>
                        </div>
                      </div>

                      {/* Quota Limits */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400 font-semibold">Gemini Quota Status:</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${data.workerHealth.quotaExhausted ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                            {data.workerHealth.quotaExhausted ? 'Rate-limited (429)' : 'Clean Quota'}
                          </span>
                        </div>
                        {data.workerHealth.quotaExhausted && (
                          <div className="flex items-center justify-between text-xs border-t border-gray-200/50 dark:border-gray-800/40 pt-2">
                            <span className="text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1">
                              <Hourglass className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                              Backoff Time Remaining:
                            </span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {getBackoffTimer(data.workerHealth.quotaBackoffUntil) || 'Reseting...'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ingestion Failure Journal */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Recent Failure Journal</h3>
                {data.recentFailures.length === 0 ? (
                  <div className="p-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Your ingestion pipeline is perfectly clean! No recent failures.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.recentFailures.map((fail) => (
                      <div key={fail.id} className="p-4 bg-red-50/10 dark:bg-rose-950/5 border border-rose-100/50 dark:border-rose-950/20 rounded-2xl space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{fail.title || 'Untitled Bookmark'}</h4>
                          <span className="text-[9px] bg-red-50 dark:bg-rose-950/40 text-red-600 dark:text-rose-400 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                            Retry: {fail.retry_count}
                          </span>
                        </div>
                        <a 
                          href={fail.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[10px] text-accent hover:underline flex items-center gap-1 w-fit max-w-full truncate"
                        >
                          <Link className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{fail.url}</span>
                        </a>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold border-t border-gray-200/40 dark:border-gray-800/40 pt-2">
                          Reason: <span className="font-mono text-red-600 dark:text-rose-400">{fail.error_message}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default IngestionDiagnosticsModal
