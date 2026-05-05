import { useState } from 'react'
import { Link } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'
import { createAppRecord } from '../services/firestorePortal'
import { triggerSyncForApp } from '../services/syncApi'

function AppMonitorPage() {
  const apps = usePortalStore((state) => state.apps)
  const currentUser = usePortalStore((state) => state.currentUser)
  const [packageId, setPackageId] = useState('')
  const [appName, setAppName] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [message, setMessage] = useState('')

  const handleCreateApp = async (event) => {
    event.preventDefault()
    if (!packageId || !appName) return
    await createAppRecord({
      packageId,
      name: appName,
      targetCount: 200,
      ratePerReview: 10,
      ownerUserId: currentUser?.id ?? null,
    })
    setPackageId('')
    setAppName('')
    setMessage('App added to Firestore.')
  }

  const handleSync = async (app) => {
    try {
      await triggerSyncForApp({
        appId: app.id,
        packageId: app.packageId,
        targetDate: targetDate || new Date().toISOString(),
        selectedHint: app.hintSymbol ?? ',',
        hintMode: 'hint-wise',
        ownerUserId: app.ownerUserId ?? currentUser?.id ?? null,
      })
      setMessage(`Sync complete for ${app.name}`)
    } catch (error) {
      setMessage(`Sync failed: ${error.message}`)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">App Monitor</h2>
        <p className="text-sm text-slate-500">Manage app links and sync visibility</p>
      </div>
      <form
        onSubmit={handleCreateApp}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
      >
        <input
          value={appName}
          onChange={(event) => setAppName(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
          placeholder="App name"
        />
        <input
          value={packageId}
          onChange={(event) => setPackageId(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Package ID (com.app.name)"
        />
        <input
          type="date"
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          Add App
        </button>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        {apps.map((app) => (
          <article key={app.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{app.name}</h3>
              <span className={`rounded-full px-2 py-1 text-xs ${app.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {app.active ? 'Active' : 'Paused'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{app.category}</p>
            <p className="mt-3 text-xs text-slate-500">Last synced: {app.syncedAt}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => handleSync(app)}
                className="inline-flex rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Sync
              </button>
              <Link to={`/app/${app.id}`} className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
                Open App Detail
              </Link>
            </div>
          </article>
        ))}
      </div>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  )
}

export default AppMonitorPage
