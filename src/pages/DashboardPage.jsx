import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'

function AppIcon({ app }) {
  const [failed, setFailed] = useState(false)
  const showImage = app.icon && !failed

  return (
    <div className={`h-10 w-10 overflow-hidden rounded-xl flex items-center justify-center font-bold text-white shadow-lg ${showImage ? 'bg-white' : app.monitoringStatus === 'ACTIVE' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-slate-400'}`}>
      {showImage ? (
        <img
          src={app.icon}
          alt={`${app.name} logo`}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        app.name.charAt(0)
      )}
    </div>
  )
}

function StatCard({ title, value, tone }) {
  const theme = usePortalStore((state) => state.theme)
  const colors = {
    blue: 'from-blue-600 to-blue-500 shadow-blue-500/20',
    green: 'from-emerald-600 to-emerald-500 shadow-emerald-500/20',
    red: 'from-rose-600 to-rose-500 shadow-rose-500/20',
    purple: 'from-violet-600 to-violet-500 shadow-violet-500/20',
  }

  return (
    <div className={`group relative overflow-hidden rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl shadow-xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
      <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${colors[tone]} opacity-5 transition-transform duration-700 group-hover:scale-150`} />
      
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className={`rounded-xl md:rounded-2xl p-2 md:p-3 bg-gradient-to-br ${colors[tone]} shadow-lg`}>
             {tone === 'blue' && <svg className="h-5 w-5 md:h-6 md:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
             {tone === 'green' && <svg className="h-5 w-5 md:h-6 md:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
             {tone === 'red' && <svg className="h-5 w-5 md:h-6 md:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
             {tone === 'purple' && <svg className="h-5 w-5 md:h-6 md:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
          </div>
          <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Realtime</span>
        </div>
        
        <div>
          <p className={`text-[9px] md:text-sm font-bold uppercase tracking-widest mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
          <h3 className={`text-lg md:text-4xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
        </div>
        
        <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-800/10 flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${colors[tone]}`} />
          <span className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live data stream</span>
        </div>
      </div>
    </div>
  )
}

function DashboardPage() {
  const apps = usePortalStore((state) => state.apps)
  const reviews = usePortalStore((state) => state.reviews)
  const clients = usePortalStore((state) => state.clients)
  const theme = usePortalStore((state) => state.theme)
  const [selectedClientId, setSelectedClientId] = useState('all')

  const filteredApps = useMemo(() => {
    if (selectedClientId === 'all') return apps
    return apps.filter(app => app.clientId === selectedClientId)
  }, [apps, selectedClientId])

  const stats = useMemo(() => {
    const safeReviews = Array.isArray(reviews) ? reviews : []
    const relevantAppIds = new Set(filteredApps.map(app => app.id))
    const relevantReviews = safeReviews.filter(review => relevantAppIds.has(review.appId))

    const verifiedLive = relevantReviews.filter((review) => review.status === 'VERIFIED LIVE').length
    const dropped = relevantReviews.filter((review) => review.status === 'DROPPED').length
    const activeLinks = filteredApps.filter((app) => app.monitoringStatus === 'ACTIVE').length
    
    const totalRevenue = filteredApps.reduce((sum, app) => {
      const liveCountForApp = relevantReviews.filter(
        (review) => review.appId === app.id && review.status === 'VERIFIED LIVE'
      ).length
      const rate = parseFloat(app.ratePerReview || 0)
      return sum + (liveCountForApp * rate)
    }, 0)

    return {
      verifiedLive,
      dropped,
      activeLinks,
      totalRevenue: totalRevenue.toLocaleString('en-IN'),
    }
  }, [filteredApps, reviews])

  const currentUser = usePortalStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === 'admin'

  return (
    <section className="space-y-6 animate-in fade-in duration-700">
      {/* Mobile-First Dashboard Header */}
      <div className="md:hidden space-y-2 mb-8">
        <h1 className={`text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Overview</h1>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Live Operation Statistics</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 hidden md:flex">
        <div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Dashboard</h2>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Central command view for live operations</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Client:</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className={`rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
            >
              <option value="all">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mobile App Filters */}
      <div className="md:hidden grid grid-cols-2 gap-3 mb-4">
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className={`w-full rounded-2xl border-none p-4 text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/10 focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} col-span-2`}
        >
          <option value="all">All Clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Revenue" value={`Rs ${stats.totalRevenue}`} tone="blue" />
        <StatCard title="Verified Live" value={stats.verifiedLive} tone="green" />
        <StatCard title="Total Dropped" value={stats.dropped} tone="red" />
        <StatCard title="Active Links" value={stats.activeLinks} tone="purple" />
      </div>

      <div className={`rounded-2xl border p-6 shadow-xl transition-all duration-300 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <h3 className={`text-lg font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Recent Activity {selectedClientId !== 'all' ? `(Filtered)` : ''}
        </h3>
        <div className="space-y-4">
          {filteredApps.slice(0, 5).map((app) => (
            <Link 
              key={app.id} 
              to={`/app/${app.id}`} 
              className={`flex items-center justify-between rounded-xl border p-4 transition-all hover:scale-[1.01] hover:shadow-md ${theme === 'dark' ? 'border-slate-800 bg-slate-950/50 hover:bg-slate-800' : 'border-slate-100 bg-slate-50 hover:bg-white'}`}
            >
              <div className="flex items-center gap-4">
                <AppIcon app={app} />
                <div>
                  <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{app.name}</p>
                  <div className="flex gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{app.category}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                      {clients.find(c => c.id === app.clientId)?.name || 'General'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last Sync</p>
                <p className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{app.syncedAt}</p>
              </div>
            </Link>
          ))}
          {filteredApps.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No recent activity found</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default DashboardPage
