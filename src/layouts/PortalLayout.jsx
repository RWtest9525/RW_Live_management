import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'

const navItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Money Tracker', path: '/money-tracker' },
  { label: 'App Monitor', path: '/app-monitor' },
  { label: 'Worker Panel', path: '/worker-panel' },
  { label: 'Proof Gallery', path: '/proof-gallery' },
]

function PortalLayout() {
  const logout = usePortalStore((state) => state.logout)
  const initializeFirestore = usePortalStore((state) => state.initializeFirestore)
  const currentUser = usePortalStore((state) => state.currentUser)
  const firestoreError = usePortalStore((state) => state.firestoreError)
  const navigate = useNavigate()

  useEffect(() => {
    initializeFirestore()
  }, [initializeFirestore])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-64 border-r border-slate-200 bg-slate-950 p-5 text-white">
        <h1 className="mb-8 text-2xl font-bold">Review World</h1>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-800">Business Management Portal</p>
            <p className="text-xs text-slate-500">
              {currentUser?.email} ({currentUser?.role ?? 'user'})
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Logout
          </button>
        </header>
        <main className="p-6">
          {firestoreError ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {firestoreError}
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default PortalLayout
