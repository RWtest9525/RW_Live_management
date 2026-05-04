import { Link } from 'react-router-dom'
import StatCard from '../components/StatCard'
import usePortalStore from '../store/usePortalStore'

function DashboardPage() {
  const apps = usePortalStore((state) => state.apps)
  const stats = usePortalStore((state) => state.getDashboardStats())

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-500">Central command view for live operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Revenue" value={`Rs ${stats.totalRevenue}`} tone="blue" />
        <StatCard title="Verified Live" value={stats.verifiedLive} tone="green" />
        <StatCard title="Total Dropped" value={stats.dropped} tone="red" />
        <StatCard title="Active Links" value={stats.activeLinks} tone="purple" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
        <div className="mt-4 space-y-3">
          {apps.slice(0, 5).map((app) => (
            <Link key={app.id} to={`/app/${app.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50">
              <div>
                <p className="font-semibold text-slate-800">{app.name}</p>
                <p className="text-sm text-slate-500">{app.category}</p>
              </div>
              <p className="text-xs text-slate-500">Synced {app.syncedAt}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default DashboardPage
