import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import InfiniteReviewList from '../components/InfiniteReviewList'
import usePortalStore from '../store/usePortalStore'
import { triggerSyncForApp } from '../services/syncApi'
import { matchesReviewByHintMode } from '../../shared/reviewHints'

function AppDetailPage() {
  const { id } = useParams()
  const apps = usePortalStore((state) => state.apps)
  const reviews = usePortalStore((state) => state.reviews)
  const clients = usePortalStore((state) => state.clients)
  const currentUser = usePortalStore((state) => state.currentUser)
  const theme = usePortalStore((state) => state.theme)
  
  const fetchLocalReviews = usePortalStore((state) => state.fetchLocalReviews)
  const loadInitialData = usePortalStore((state) => state.loadInitialData)
  
  const [activeHintFilter, setActiveHintFilter] = useState('all') // 'all', 'no-hint', or specific hint
  const [dayFilter, setDayFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('VERIFIED LIVE') // 'VERIFIED LIVE', 'DROPPED', 'PENDING'
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const previousSyncProgressRef = useRef(null)
  const app = useMemo(() => apps.find((entry) => entry.id === id), [apps, id])

  useEffect(() => {
    if (id) {
      void fetchLocalReviews(id)
    }
  }, [id, fetchLocalReviews])

  useEffect(() => {
    if (!id || !app || app.syncProgress === null || app.syncProgress === undefined) {
      previousSyncProgressRef.current = app?.syncProgress ?? null
      return undefined
    }

    const intervalId = setInterval(() => {
      void fetchLocalReviews(id)
    }, 8000)

    return () => clearInterval(intervalId)
  }, [app, fetchLocalReviews, id])

  useEffect(() => {
    const previous = previousSyncProgressRef.current
    const current = app?.syncProgress ?? null

    if (
      id &&
      previous !== null &&
      previous !== undefined &&
      (current === null || current === undefined)
    ) {
      void fetchLocalReviews(id)
      void loadInitialData()
    }

    previousSyncProgressRef.current = current
  }, [app?.syncProgress, fetchLocalReviews, id, loadInitialData])

  // Get all available hints for this app
  const availableHints = useMemo(() => {
    if (!app?.selectedHint) return []
    return app.selectedHint.split(',').map(h => h.trim()).filter(Boolean)
  }, [app])

  const appReviews = useMemo(() => {
    const safeReviews = Array.isArray(reviews) ? reviews : []
    let filtered = safeReviews.filter((review) => review.appId === id)

    // Day Filter
    if (dayFilter !== 'all') {
      const dayNum = parseInt(dayFilter.replace('day', ''))
      filtered = filtered.filter((review) => {
        // Use the day number calculated during sync
        return Number(review.reviewDayNumber) === dayNum || Number(review.droppedDayNumber) === dayNum
      })
    }

    // Status Filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter)
    }

    // Hint Filter (Logic for connecting filters)
    if (activeHintFilter !== 'all') {
      filtered = filtered.filter(r => {
        if (activeHintFilter === 'no-hint') {
          return matchesReviewByHintMode({ text: r.content, hintMode: 'no-hint' })
        }
        return matchesReviewByHintMode({ text: r.content, hintMode: 'strict-hint', selectedHint: activeHintFilter })
      })
    }

    return filtered.sort((a, b) => {
      const bTime = new Date(b.date || 0).getTime()
      const aTime = new Date(a.date || 0).getTime()
      return bTime - aTime
    })
  }, [reviews, id, dayFilter, statusFilter, activeHintFilter])

  const dayWiseStats = useMemo(() => {
    const stats = {}
    const totalDays = app?.listDays || 7
    const safeReviews = Array.isArray(reviews) ? reviews : []
    for (let i = 1; i <= totalDays; i++) {
      const dayReviews = safeReviews.filter(r => r.appId === id && (Number(r.reviewDayNumber) === i || Number(r.droppedDayNumber) === i))
      stats[i] = {
        live: dayReviews.filter(r => r.status === 'VERIFIED LIVE').length,
        dropped: dayReviews.filter(r => r.status === 'DROPPED').length
      }
    }
    return stats
  }, [reviews, id, app])

  const handleSync = async () => {
    if (!app) return
    setSyncing(true)
    setMessage('')
    try {
      await triggerSyncForApp({
        appId: app.id,
        packageId: app.packageId,
        targetDate: app.targetDate || new Date().toISOString(),
        selectedHint: app.selectedHint ?? '.',
        hintMode: app.hintMode ?? 'no-hint',
        ownerUserId: app.ownerUserId ?? currentUser?.id ?? null,
        stopCheckingAfter: app.stopCheckingAfter ?? null,
        starRating: app.starRating ?? null,
      })
      setMessage('Sync started. It runs in background. Reviews will refresh without blinking the page.')
    } catch (error) {
      setMessage(`Sync failed: ${error.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const exportToCSV = () => {
    const headers = ['User', 'Rating', 'Date', 'Time', 'Day', 'Status', 'Content']
    const rows = appReviews.map((r) => [
      r.userName || 'User',
      r.score || 5,
      new Date(r.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
      new Date(r.date).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
      r.reviewDayNumber || '-',
      r.status || 'Pending',
      (r.content || '').replace(/,/g, ' '),
    ])

    const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `${app?.name || 'app'}_reviews_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!app) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 font-bold">Application not found</div>
  }

  return (
    <section className="relative space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <button
            onClick={() => window.history.back()}
            className={`rounded-full p-3 transition-all transform active:scale-90 ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex items-center gap-4">
            {app.icon && (
              <img src={app.icon} className="h-16 w-16 rounded-3xl shadow-2xl border-4 border-white dark:border-slate-800" alt="" />
            )}
            <div>
              <h2 className={`text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{app.name}</h2>
              <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                {clients.find(c => c.id === app.clientId)?.name || 'General Client'} • {app.packageId}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || (app.syncProgress !== null && app.syncProgress !== undefined)}
            className="rounded-2xl bg-blue-600 px-8 py-3.5 text-xs font-black text-white hover:bg-blue-700 shadow-xl shadow-blue-900/30 transition-all transform active:scale-95 disabled:bg-blue-300 flex items-center gap-2 relative overflow-hidden min-h-[48px]"
          >
            {(app.syncProgress !== null && app.syncProgress !== undefined) ? (
              <>
                {app.syncProgress === -1 ? (
                  <div className="absolute inset-0 bg-white/10 animate-pulse" />
                ) : (
                  <div
                    className="absolute inset-0 bg-white/20 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, app.syncProgress))}%` }}
                  />
                )}
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin relative z-10 shrink-0" />
                {app.syncProgress === -1 ? (
                  <span className="relative z-10 max-w-[220px] truncate text-[10px] font-bold leading-snug">
                    {app.syncStatus || 'Syncing…'}
                  </span>
                ) : (
                  <span className="relative z-10">SYNC {app.syncProgress}%</span>
                )}
              </>
            ) : syncing ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>SYNCING...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>SYNC REVIEWS</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Day-wise Quick Select */}
        <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {Object.entries(dayWiseStats).map(([day, data]) => (
            <button
              key={day}
              onClick={() => setDayFilter(dayFilter === `day${day}` ? 'all' : `day${day}`)}
              className={`rounded-2xl border p-4 transition-all transform active:scale-95 text-left ${dayFilter === `day${day}` ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10' : theme === 'dark' ? 'border-slate-800 bg-slate-900 hover:bg-slate-800' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
            >
              <p className={`text-[10px] font-black uppercase tracking-widest ${dayFilter === `day${day}` ? 'text-blue-500' : 'text-slate-500'}`}>Day {day}</p>
              <div className="mt-2 flex items-end justify-between">
                <span className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{data.live}</span>
                <span className="text-[10px] font-bold text-rose-500">-{data.dropped}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Sidebar Filters */}
        <div className="space-y-6">
          <div className={`rounded-3xl border p-6 shadow-xl ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
            <h3 className={`mb-5 text-xs font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Hint Filter</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setActiveHintFilter('all')}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold text-left transition-all ${activeHintFilter === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                Show All
              </button>
              <button
                onClick={() => setActiveHintFilter('no-hint')}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold text-left transition-all ${activeHintFilter === 'no-hint' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                No Hint / Dot
              </button>
              {availableHints.map((hint, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveHintFilter(hint)}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold text-left transition-all ${activeHintFilter === hint ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  Hint: "{hint}"
                </button>
              ))}
            </div>

            <h3 className={`mt-8 mb-5 text-xs font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Status Filter</h3>
            <div className="flex flex-col gap-2">
              {['VERIFIED LIVE', 'DROPPED', 'PENDING', 'all'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold text-left transition-all ${statusFilter === status ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {status === 'all' ? 'All Status' : status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Review List */}
        <div className="lg:col-span-3 space-y-6">
          <div className={`rounded-3xl border p-8 shadow-xl ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className={`text-xl font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Review Stream</h3>
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  Showing {appReviews.length} reviews 
                  {dayFilter !== 'all' ? ` for Day ${dayFilter.replace('day', '')}` : ''}
                  {activeHintFilter !== 'all' ? ` with hint "${activeHintFilter}"` : ''}
                </p>
              </div>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20"
              >
                Export CSV
              </button>
            </div>

            <InfiniteReviewList
              key={`${id}-${dayFilter}-${statusFilter}-${activeHintFilter}`}
              reviews={appReviews}
              app={app}
            />
            
            {!appReviews.length && (
              <div className="py-20 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No reviews found for current filters</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {message && (
        <div className={`fixed bottom-6 right-6 rounded-2xl px-6 py-4 text-sm font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-300 z-50 flex items-center gap-3 ${theme === 'dark' ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white text-slate-900 border border-slate-200'}`}>
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
          {message}
        </div>
      )}
    </section>
  )
}

export default AppDetailPage
