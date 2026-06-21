import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'
import { lookupPlayStoreApp } from '../services/appApi'
import { triggerSyncForApp } from '../services/syncApi'

const defaultTime = '20:00'
const defaultRate = 13
const defaultListDays = 7
const compactActionButton =
  'flex h-10 items-center justify-center rounded-xl border text-xs font-black transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60'

const createDefaultForm = (clientId = '') => ({
  reviewLink: '',
  appName: '',
  listTime: defaultTime,
  listDate: new Date().toISOString().split('T')[0],
  starRating: '5',
  hintMode: 'strict-hint',
  selectedHints: [''],
  ratePerReview: String(defaultRate),
  clientId: clientId,
  listDays: String(defaultListDays),
})

function AppMonitorPage() {
  const apps = usePortalStore((state) => state.apps)
  const clients = usePortalStore((state) => state.clients)
  const theme = usePortalStore((state) => state.theme)
  const currentUser = usePortalStore((state) => state.currentUser)
  const refreshPortalLists = usePortalStore((state) => state.refreshPortalLists)
  const fetchLocalReviews = usePortalStore((state) => state.fetchLocalReviews)
  
  const [selectedClientId, setSelectedClientId] = useState('all')
  const [form, setForm] = useState(createDefaultForm())
  const [message, setMessage] = useState('')
  const [linkError, setLinkError] = useState('')
  const [loadingLookup, setLoadingLookup] = useState(false)
  const [editingAppId, setEditingAppId] = useState('')
  const [editForm, setEditForm] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [manualSyncingIds, setManualSyncingIds] = useState(new Set())

  const token = usePortalStore((state) => state.token)

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(''), 2000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    setManualSyncingIds((current) => {
      if (current.size === 0) return current
      const next = new Set(current)
      for (const app of apps) {
        if (
          next.has(app.id) &&
          app.syncProgress !== null &&
          app.syncProgress !== undefined
        ) {
          next.delete(app.id)
        }
      }
      return next.size === current.size ? current : next
    })
  }, [apps])

  const handleCreateApp = async (event) => {
    event.preventDefault()
    setMessage('')
    setLinkError('')

    const metadata = await handleLookup(form.reviewLink)
    if (!metadata) return

    // App Date is form.listDate
    const listDateObj = new Date(form.listDate)
    const [hours, minutes] = form.listTime.split(':')
    listDateObj.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    
    const targetDate = listDateObj.toISOString()
    const stopCheckingDate = new Date(listDateObj)
    stopCheckingDate.setDate(listDateObj.getDate() + Number(form.listDays))
    const stopCheckingAfter = stopCheckingDate.toISOString()

    const hints = form.hintMode === 'strict-hint' 
      ? form.selectedHints.filter(h => h.trim()).join(',') 
      : (form.hintMode === 'no-hint' ? '.' : '')

    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'app',
          name: form.appName || metadata.appName,
          packageId: metadata.packageId,
          storeUrl: metadata.url,
          reviewLink: metadata.url,
          ratePerReview: Number(form.ratePerReview),
          selectedHint: hints,
          hintMode: form.hintMode,
          ownerUserId: currentUser?.id ?? null,
          targetDate: targetDate, // Full ISO with time
          listDate: form.listDate, // The App Date (YYYY-MM-DD)
          listTime: form.listTime,
          stopCheckingAfter,
          starRating: Number(form.starRating),
          clientId: form.clientId || null,
          icon: metadata.icon,
          developer: metadata.developer,
          addedFrom: 'manual',
          listDays: Number(form.listDays)
        })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || payload.details || 'Failed to add app')
      }

      setForm(createDefaultForm(selectedClientId !== 'all' ? selectedClientId : ''))
      setShowAddForm(false)
      setMessage('App added successfully.')
      void refreshPortalLists()
    } catch (err) {
      setMessage(`Failed: ${err.message}`)
    }
  }

  const handleDeleteApp = async (appId) => {
    if (!window.confirm('Are you sure you want to delete this app? All associated reviews will be lost.')) return
    try {
      const response = await fetch(`/api/data?type=app&id=${appId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete app')
      }
      setMessage('App deleted successfully.')
      await refreshPortalLists()
    } catch (err) {
      console.error('Delete failed:', err)
      setMessage(`Delete failed: ${err.message}`)
    }
  }

  const handleUpdateStatus = async (appId, newStatus) => {
    try {
      await fetch('/api/data', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'app', id: appId, monitoringStatus: newStatus })
      })
      void refreshPortalLists()
    } catch (err) {
      console.error('Status update failed:', err)
    }
  }
  
  // Bulk Add State
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkInput, setBulkLinks] = useState('')
  const [bulkApps, setBulkApps] = useState([]) // Array of { link, name, packageId, status: 'pending'|'loading'|'ready'|'error' }
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkSettings, setBulkSettings] = useState({
    hintMode: 'strict-hint',
    selectedHints: [''],
    ratePerReview: String(defaultRate),
    listTime: defaultTime,
    listDays: String(defaultListDays),
    starRating: '5'
  })

  // Filter apps by client
  const filteredApps = useMemo(() => {
    if (selectedClientId === 'all') return apps
    return apps.filter(app => app.clientId === selectedClientId)
  }, [apps, selectedClientId])

  // Update form clientId when selection changes
  useEffect(() => {
    if (selectedClientId !== 'all') {
      setForm(prev => ({ ...prev, clientId: selectedClientId }))
    }
  }, [selectedClientId])

  // Process bulk input into boxes
  useEffect(() => {
    const links = bulkInput.split('\n').map(l => l.trim()).filter(Boolean)
    const newBulkApps = links.map(link => {
      const existing = bulkApps.find(a => a.link === link)
      return existing || { link, name: 'Fetching...', packageId: '', status: 'pending', icon: '' }
    })
    setBulkApps(newBulkApps)

    // Trigger lookup for new pending links
    newBulkApps.forEach((app, index) => {
      if (app.status === 'pending') {
        fetchBulkMetadata(app.link, index)
      }
    })
  }, [bulkInput])

  const fetchBulkMetadata = async (link, index) => {
    setBulkApps(prev => {
      const next = [...prev]
      if (next[index]) next[index].status = 'loading'
      return next
    })
    try {
      const meta = await lookupPlayStoreApp(link)
      setBulkApps(prev => {
        const next = [...prev]
        if (next[index]) {
          next[index] = { 
            ...next[index], 
            name: meta.name, 
            packageId: meta.packageId, 
            status: 'ready',
            icon: meta.icon,
            developer: meta.developer,
            url: meta.storeUrl
          }
        }
        return next
      })
    } catch (err) {
      setBulkApps(prev => {
        const next = [...prev]
        if (next[index]) {
          next[index].name = 'Invalid Link'
          next[index].status = 'error'
        }
        return next
      })
    }
  }

  const handleLookup = async (value) => {
    if (!value.trim()) return null
    setLoadingLookup(true)
    setLinkError('')
    try {
      const app = await lookupPlayStoreApp(value)
      setForm(prev => ({
        ...prev,
        appName: app.name,
        reviewLink: app.storeUrl
      }))
      return {
        appName: app.name,
        url: app.storeUrl,
        packageId: app.packageId,
        icon: app.icon,
        developer: app.developer
      }
    } catch (error) {
      setLinkError(error.message)
      return null
    } finally {
      setLoadingLookup(false)
    }
  }

  const handleBulkAdd = async () => {
    const readyApps = bulkApps.filter(a => a.status === 'ready')
    if (!readyApps.length) return
    
    setBulkLoading(true)
    let successCount = 0
    let failCount = 0

    const hints = bulkSettings.hintMode === 'strict-hint' 
      ? bulkSettings.selectedHints.filter(h => h.trim()).join(',') 
      : (bulkSettings.hintMode === 'no-hint' ? '.' : '')

    for (const app of readyApps) {
      try {
        const listDateObj = new Date(form.listDate) // Use common date from form
        const [hours, minutes] = bulkSettings.listTime.split(':')
        listDateObj.setHours(parseInt(hours), parseInt(minutes), 0, 0)

        const targetDate = listDateObj.toISOString()
        const stopCheckingDate = new Date(listDateObj)
        stopCheckingDate.setDate(listDateObj.getDate() + Number(bulkSettings.listDays))
        const stopCheckingAfter = stopCheckingDate.toISOString()

        const response = await fetch('/api/data', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            type: 'app',
            name: app.name,
            packageId: app.packageId,
            storeUrl: app.url,
            reviewLink: app.url,
            ratePerReview: Number(bulkSettings.ratePerReview),
            selectedHint: hints,
            hintMode: bulkSettings.hintMode,
            ownerUserId: currentUser?.id ?? null,
            targetDate: targetDate,
            listDate: listDateObj.toISOString().split('T')[0],
            listTime: bulkSettings.listTime,
            stopCheckingAfter,
            starRating: Number(bulkSettings.starRating),
            clientId: selectedClientId !== 'all' ? selectedClientId : null,
            icon: app.icon,
            developer: app.developer,
            addedFrom: 'bulk',
            listDays: Number(bulkSettings.listDays)
          })
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || payload.details || 'Failed to add app')
        }
        successCount++
      } catch (err) {
        console.error('Bulk app add failed:', err)
        failCount++
      }
    }

    setBulkLoading(false)
    setShowBulkForm(false)
    setBulkLinks('')
    setBulkApps([])
    setMessage(`Bulk add complete: ${successCount} success, ${failCount} failed.`)
    void refreshPortalLists()
  }

  const addHintField = (isBulk = false) => {
    if (isBulk) {
      setBulkSettings(prev => ({ ...prev, selectedHints: [...prev.selectedHints, ''] }))
    } else {
      setForm(prev => ({ ...prev, selectedHints: [...prev.selectedHints, ''] }))
    }
  }

  const updateHintField = (index, value, isBulk = false) => {
    if (isBulk) {
      const newHints = [...bulkSettings.selectedHints]
      newHints[index] = value
      setBulkSettings(prev => ({ ...prev, selectedHints: newHints }))
    } else {
      const newHints = [...form.selectedHints]
      newHints[index] = value
      setForm(prev => ({ ...prev, selectedHints: newHints }))
    }
  }

  const removeHintField = (index, isBulk = false) => {
    if (isBulk) {
      const newHints = bulkSettings.selectedHints.filter((_, i) => i !== index)
      setBulkSettings(prev => ({ ...prev, selectedHints: newHints.length ? newHints : [''] }))
    } else {
      const newHints = form.selectedHints.filter((_, i) => i !== index)
      setForm(prev => ({ ...prev, selectedHints: newHints.length ? newHints : [''] }))
    }
  }

  const handleSync = async (app) => {
    try {
      setManualSyncingIds((current) => new Set(current).add(app.id))
      setMessage(`Manual sync started for ${app.name}. Old Play Store dates can take time because Google must be paged line-by-line.`)
      await triggerSyncForApp({
        appId: app.id,
        packageId: app.packageId,
        targetDate: app.targetDate || new Date().toISOString(),
        selectedHint: app.selectedHint ?? ',',
        hintMode: app.hintMode ?? 'strict-hint',
        ownerUserId: app.ownerUserId ?? currentUser?.id ?? null,
        stopCheckingAfter: app.stopCheckingAfter ?? null,
        starRating: app.starRating ?? null,
      })
      setMessage(`Sync started for ${app.name}. It will continue in background.`)
      window.setTimeout(() => void refreshPortalLists(), 500)
      ;[1500, 3000, 6000, 10000, 18000, 30000, 45000, 75000, 120000].forEach((delay) => {
        window.setTimeout(() => {
          void refreshPortalLists()
          void fetchLocalReviews(app.id)
        }, delay)
      })
    } catch (error) {
      setMessage(`Sync failed: ${error.message}`)
      setManualSyncingIds((current) => {
        const next = new Set(current)
        next.delete(app.id)
        return next
      })
    }
  }

  const startEditing = (app) => {
    setEditingAppId(app.id)
    const hints = (app.selectedHint ?? '').split(',').filter(Boolean)
    setEditForm({
      name: app.name,
      listTime: app.listTime ?? defaultTime,
      starRating: String(app.starRating ?? 5),
      hintMode: app.hintMode ?? 'strict-hint',
      selectedHints: hints.length ? hints : [''],
      ratePerReview: String(app.ratePerReview ?? defaultRate),
      clientId: app.clientId ?? '',
      listDays: String(app.listDays ?? defaultListDays)
    })
  }

  const saveEdit = async (appId) => {
    const hints = editForm.hintMode === 'strict-hint' 
      ? editForm.selectedHints.filter(h => h.trim()).join(',') 
      : (editForm.hintMode === 'no-hint' ? '.' : '')

    try {
      await fetch('/api/data', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'app',
          id: appId,
          name: editForm.name,
          listTime: editForm.listTime,
          starRating: Number(editForm.starRating),
          hintMode: editForm.hintMode,
          selectedHint: hints,
          ratePerReview: Number(editForm.ratePerReview),
          clientId: editForm.clientId || null,
          listDays: Number(editForm.listDays)
        })
      })
      setEditingAppId('')
      setEditForm({})
      setMessage('App updated successfully.')
      void refreshPortalLists()
    } catch (err) {
      console.error('Update failed:', err)
    }
  }

  const removeApp = async (appId) => {
    if (!window.confirm('Are you sure you want to remove this app?')) return
    try {
      const response = await fetch(`/api/data?type=app&id=${appId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete app')
      }
      setMessage('App deleted successfully.')
      await refreshPortalLists()
    } catch (err) {
      console.error('Delete failed:', err)
      setMessage(`Delete failed: ${err.message}`)
    }
  }

  return (
    <section className="space-y-6 pb-20">
      {/* Mobile Header (App Style) */}
      <div className="md:hidden space-y-2">
        <h2 className={`text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>App Monitor</h2>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Manage Live Campaigns</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 hidden md:flex">
        <div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>App Monitor</h2>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Manage and monitor your Play Store applications.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex flex-col gap-1 flex-1 sm:flex-none sm:mr-4">
            <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Filter by Client</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className={`w-full sm:w-auto rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
            >
              <option value="all">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <button
              onClick={() => { setShowBulkForm(!showBulkForm); setShowAddForm(false); }}
              className={`flex-1 sm:flex-none rounded-xl px-5 py-2.5 text-sm font-bold transition-all transform active:scale-95 ${showBulkForm ? 'bg-slate-800 text-white shadow-lg shadow-slate-900/20' : theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {showBulkForm ? 'Close' : 'Bulk'}
            </button>
            <button
              onClick={() => { setShowAddForm(!showAddForm); setShowBulkForm(false); }}
              className="flex-1 sm:flex-none rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all transform active:scale-95"
            >
              {showAddForm ? 'Close' : '+ App'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile App Controls (Floating-like style) */}
      <div className="md:hidden flex flex-col gap-4">
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className={`w-full rounded-2xl border-none p-4 text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/10 focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
        >
          <option value="all">All Clients</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setShowBulkForm(!showBulkForm); setShowAddForm(false); }}
            className={`rounded-2xl p-4 text-xs font-black uppercase tracking-widest transition-all shadow-lg ${showBulkForm ? 'bg-slate-800 text-white' : theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-600'}`}
          >
            {showBulkForm ? 'Close Bulk' : 'Bulk Importer'}
          </button>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setShowBulkForm(false); }}
            className="rounded-2xl bg-blue-600 p-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 active:scale-95"
          >
            {showAddForm ? 'Close Form' : '+ New App'}
          </button>
        </div>
      </div>

      {showBulkForm && (
        <div className={`rounded-3xl border p-8 shadow-2xl animate-in zoom-in-95 duration-300 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className="mb-8 border-b border-slate-800 pb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className={`text-xl font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Bulk App Importer</h3>
              <p className="mt-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                Adding to client: <span className="text-blue-500 underline font-black">{selectedClientId === 'all' ? 'GENERAL CLIENT' : clients.find(c => c.id === selectedClientId)?.name}</span>
              </p>
              <div className="mt-4 flex items-center gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Global App Date:</label>
                <input
                  type="date"
                  value={form.listDate}
                  onChange={(e) => setForm({ ...form, listDate: e.target.value })}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Total Ready:</span>
              <span className="text-lg font-black text-blue-600">{bulkApps.filter(a => a.status === 'ready').length}</span>
            </div>
          </div>

          <div className="space-y-8">
            {/* Step 1: Link Input */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">1</div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Paste Play Store Links (One per line)</label>
              </div>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkLinks(e.target.value)}
                className={`w-full h-32 rounded-2xl border p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                placeholder="https://play.google.com/store/apps/details?id=com.example.app"
              />
            </div>

            {/* Step 2: Shared Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">2</div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shared Features for All Apps</label>
              </div>
              
              <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'} grid gap-5 md:grid-cols-2 lg:grid-cols-4`}>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black text-slate-500 uppercase tracking-widest">Hint Mode</label>
                  <select
                    value={bulkSettings.hintMode}
                    onChange={(e) => setBulkSettings({...bulkSettings, hintMode: e.target.value})}
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs font-bold ${theme === 'dark' ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}
                  >
                    <option value="show-all">Show All</option>
                    <option value="no-hint">No Hint (Dot)</option>
                    <option value="strict-hint">Type Hint</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-black text-slate-500 uppercase tracking-widest">Rate (Rs)</label>
                  <input
                    type="number"
                    value={bulkSettings.ratePerReview}
                    onChange={(e) => setBulkSettings({...bulkSettings, ratePerReview: e.target.value})}
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs font-bold ${theme === 'dark' ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-black text-slate-500 uppercase tracking-widest">List Days</label>
                  <input
                    type="number"
                    value={bulkSettings.listDays}
                    onChange={(e) => setBulkSettings({...bulkSettings, listDays: e.target.value})}
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs font-bold ${theme === 'dark' ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-black text-slate-500 uppercase tracking-widest">Check Time</label>
                  <input
                    type="time"
                    value={bulkSettings.listTime}
                    onChange={(e) => setBulkSettings({...bulkSettings, listTime: e.target.value})}
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs font-bold ${theme === 'dark' ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Rating</label>
                  <select
                    value={bulkSettings.starRating}
                    onChange={(e) => setBulkSettings({...bulkSettings, starRating: e.target.value})}
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs font-bold ${theme === 'dark' ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}
                  >
                    {[5, 4, 3, 2, 1].map((star) => (
                      <option key={star} value={star}>{star} Star</option>
                    ))}
                  </select>
                </div>

                {bulkSettings.hintMode === 'strict-hint' && (
                  <div className="lg:col-span-4 space-y-3 pt-2 border-t border-slate-800/50 mt-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Hints (Applied to all boxes below)</label>
                    <div className="flex flex-wrap gap-2">
                      {bulkSettings.selectedHints.map((hint, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 shadow-sm">
                          <input
                            value={hint}
                            onChange={(e) => updateHintField(idx, e.target.value, true)}
                            placeholder="e.g. ,,"
                            className="w-20 text-sm font-black bg-transparent outline-none text-blue-500"
                          />
                          <button type="button" onClick={() => removeHintField(idx, true)} className="text-rose-500 hover:text-rose-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addHintField(true)} className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all font-black text-xl">+</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Auto-Arranged Boxes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">3</div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Auto-Arranged App Boxes</label>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider italic">Metadata fetches automatically...</span>
              </div>
              
              <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 min-h-[200px] max-h-[600px] overflow-y-auto p-1 scrollbar-hide`}>
                {bulkApps.map((app, idx) => (
                  <div key={idx} className={`relative group flex flex-col p-4 rounded-2xl border transition-all duration-300 ${app.status === 'ready' ? 'border-emerald-500/30 bg-emerald-500/5' : app.status === 'error' ? 'border-rose-500/30 bg-rose-500/5' : theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center flex-shrink-0 shadow-md border border-slate-700/50">
                        {app.icon ? <img src={app.icon} className="h-full w-full object-cover" /> : <span className="text-sm font-black text-slate-500">{idx+1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          value={app.name}
                          onChange={(e) => {
                            const newApps = [...bulkApps]
                            newApps[idx].name = e.target.value
                            setBulkApps(newApps)
                          }}
                          className={`w-full bg-transparent border-none p-0 text-sm font-black focus:ring-0 truncate ${app.status === 'error' ? 'text-rose-500' : theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                          placeholder="App Name..."
                        />
                        <p className="text-[9px] font-bold text-slate-500 truncate uppercase tracking-tight">{app.packageId || 'Analyzing link...'}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {app.status === 'loading' && <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                        {app.status === 'ready' && <div className="h-5 w-5 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>}
                        {app.status === 'error' && <div className="h-5 w-5 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/20"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div>}
                      </div>
                    </div>
                    
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50">Rs {bulkSettings.ratePerReview}</span>
                      <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50">{bulkSettings.listDays} Days</span>
                      {bulkSettings.hintMode === 'strict-hint' && bulkSettings.selectedHints.some(h => h.trim()) && (
                        <span className="text-[7px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 truncate max-w-[100px]">
                          Hints: {bulkSettings.selectedHints.filter(h => h.trim()).join(',')}
                        </span>
                      )}
                      {bulkSettings.hintMode === 'no-hint' && (
                        <span className="text-[7px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">No Hint (.)</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/20">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${app.status === 'ready' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{app.status === 'ready' ? 'Ready to Import' : app.status === 'loading' ? 'Fetching...' : 'Check Link'}</span>
                      </div>
                      <button 
                        onClick={() => {
                          const newLinks = bulkInput.split('\n').filter((_, i) => i !== idx).join('\n')
                          setBulkLinks(newLinks)
                        }}
                        className="text-slate-500 hover:text-rose-500 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {!bulkApps.length && (
                  <div className="col-span-full h-40 flex flex-col items-center justify-center text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] italic border-2 border-dashed border-slate-800 rounded-3xl opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Paste links above to generate boxes
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleBulkAdd}
            disabled={bulkLoading || !bulkApps.some(a => a.status === 'ready')}
            className="mt-10 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-5 text-sm font-black text-white hover:from-blue-700 hover:to-blue-800 transition-all shadow-2xl shadow-blue-900/40 disabled:from-slate-700 disabled:to-slate-800 transform active:scale-[0.99] flex items-center justify-center gap-3"
          >
            {bulkLoading ? (
              <>
                <div className="h-5 w-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                IMPORTING {bulkApps.filter(a => a.status === 'ready').length} APPS...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                </svg>
                CONFIRM & IMPORT {bulkApps.filter(a => a.status === 'ready').length} APPLICATIONS
              </>
            )}
          </button>
        </div>
      )}

      {showAddForm && (
        <div className={`space-y-6 rounded-2xl border p-6 shadow-xl transition-all duration-300 animate-in fade-in zoom-in-95 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Quick Add Application</h3>
          <form onSubmit={handleCreateApp} className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Play Store Link / ID</label>
              <input
                value={form.reviewLink}
                onChange={(event) => setForm((prev) => ({ ...prev, reviewLink: event.target.value }))}
                onBlur={() => handleLookup(form.reviewLink)}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                placeholder="https://play.google.com/store/apps/details?id=..."
                required
              />
              {linkError && <p className="mt-1 text-xs text-rose-500 font-medium">{linkError}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">App Name (Auto-fetched)</label>
              <input
                value={form.appName}
                readOnly
                className={`w-full rounded-xl border px-4 py-2.5 text-sm bg-slate-100 dark:bg-slate-950/50 ${theme === 'dark' ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}
                placeholder="Fetch from link"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Client</label>
              <select
                value={form.clientId}
                onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
              >
                <option value="">General</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">App Date</label>
              <input
                type="date"
                value={form.listDate}
                onChange={(event) => setForm((prev) => ({ ...prev, listDate: event.target.value }))}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hint Mode</label>
              <select
                value={form.hintMode}
                onChange={(e) => setForm({...form, hintMode: e.target.value})}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
              >
                <option value="show-all">Show All (Target Star/Date)</option>
                <option value="no-hint">No Hint (Dot or Alphanumeric)</option>
                <option value="strict-hint">Type Hint (Custom Symbols)</option>
              </select>
            </div>

            {form.hintMode === 'strict-hint' && (
              <div className="md:col-span-4 space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Custom Hints (Multiple Symbols)</label>
                <div className="flex flex-wrap gap-2">
                  {form.selectedHints.map((hint, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 shadow-sm">
                      <input
                        value={hint}
                        onChange={(e) => updateHintField(idx, e.target.value)}
                        placeholder="e.g. ,,"
                        className="w-16 text-sm font-bold bg-transparent outline-none"
                      />
                      <button type="button" onClick={() => removeHintField(idx)} className="text-rose-500 hover:text-rose-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addHintField(false)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">List Days</label>
              <input
                type="number"
                value={form.listDays}
                onChange={(event) => setForm((prev) => ({ ...prev, listDays: event.target.value }))}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                min="1"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Check Time</label>
              <input
                type="time"
                value={form.listTime}
                onChange={(event) => setForm((prev) => ({ ...prev, listTime: event.target.value }))}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Min Rating</label>
              <select
                value={form.starRating}
                onChange={(event) => setForm((prev) => ({ ...prev, starRating: event.target.value }))}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
              >
                {[5, 4, 3, 2, 1].map((star) => (
                  <option key={star} value={star}>{star} Star</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rate (Rs)</label>
              <input
                type="number"
                value={form.ratePerReview}
                onChange={(event) => setForm((prev) => ({ ...prev, ratePerReview: event.target.value }))}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                min="0"
              />
            </div>
            <div className="flex items-end lg:col-span-4">
              <button
                type="submit"
                disabled={loadingLookup}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 active:scale-95 disabled:bg-blue-300"
              >
                {loadingLookup ? 'Looking up...' : 'Add Application'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredApps.map((app) => {
          const isManualSyncing = manualSyncingIds.has(app.id)
          const hasServerProgress = app.syncProgress !== null && app.syncProgress !== undefined
          const isSyncing = isManualSyncing || hasServerProgress
          return (
          <article key={app.id} className={`group flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className={`p-4 flex-1 ${editingAppId === app.id ? 'bg-blue-500/5' : ''}`}>
              {editingAppId === app.id ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <input
                    value={editForm.name ?? ''}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                    className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white'}`}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="time" value={editForm.listTime} onChange={e => setEditForm({...editForm, listTime: e.target.value})} className={`rounded-xl border px-2 py-2 text-xs ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white'}`} />
                    <input type="number" value={editForm.ratePerReview} onChange={e => setEditForm({...editForm, ratePerReview: e.target.value})} className={`rounded-xl border px-2 py-2 text-xs ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white'}`} />
                    <input type="number" value={editForm.listDays} onChange={e => setEditForm({...editForm, listDays: e.target.value})} className={`rounded-xl border px-2 py-2 text-xs ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white'}`} />
                    <select value={editForm.clientId} onChange={e => setEditForm({...editForm, clientId: e.target.value})} className={`rounded-xl border px-2 py-2 text-xs ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white'}`}>
                      <option value="">General</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Edit Hints</label>
                    <div className="flex flex-wrap gap-2">
                      {editForm.selectedHints.map((hint, idx) => (
                        <input
                          key={idx}
                          value={hint}
                          onChange={(e) => {
                            const newHints = [...editForm.selectedHints]
                            newHints[idx] = e.target.value
                            setEditForm({...editForm, selectedHints: newHints})
                          }}
                          className={`w-12 rounded-lg border px-2 py-1 text-xs ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white'}`}
                        />
                      ))}
                      <button type="button" onClick={() => setEditForm({...editForm, selectedHints: [...editForm.selectedHints, '']})} className="w-8 h-8 rounded-lg bg-blue-600 text-white">+</button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(app.id)} className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow-lg shadow-blue-900/10">Save Changes</button>
                    <button onClick={() => setEditingAppId('')} className={`flex-1 rounded-xl py-2 text-xs font-bold ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {app.icon ? (
                        <img src={app.icon} alt="" className="h-11 w-11 rounded-2xl shadow-md border-2 border-slate-100 dark:border-slate-800" />
                      ) : (
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black text-xl shadow-lg">
                          {app.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className={`font-bold line-clamp-1 text-base ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{app.name}</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{app.packageId}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest shadow-sm ${app.active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                      {app.monitoringStatus}
                    </span>
                  </div>

                  <div className={`mb-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-2xl p-3 text-xs ${theme === 'dark' ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase font-black text-[8px] tracking-widest">App Date</p>
                      <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{app.listDate || '-'} @ {app.listTime}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase font-black text-[8px] tracking-widest">Settings</p>
                      <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{app.starRating}★ | {app.hintMode === 'strict-hint' ? `Hints: ${app.selectedHint}` : app.hintMode === 'no-hint' ? 'No Hint' : 'Show All'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase font-black text-[8px] tracking-widest">Client</p>
                      <p className="text-blue-600 font-black">{clients.find(c => c.id === app.clientId)?.name || 'General'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase font-black text-[8px] tracking-widest">Rate</p>
                      <p className={`font-black text-emerald-500`}>Rs {app.ratePerReview}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSync(app)}
                      disabled={isSyncing}
                      title={app.syncStatus || 'Sync now'}
                      aria-label={app.syncStatus || 'Sync now'}
                      className={`${compactActionButton} ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'} shadow-md relative overflow-hidden`}
                    >
                      {isSyncing ? (
                        <>
                          {isManualSyncing || app.syncProgress === -1 ? (
                            <div className="absolute inset-0 bg-blue-600/15 animate-pulse" />
                          ) : (
                            <div
                              className="absolute inset-0 bg-blue-600/20 transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, app.syncProgress))}%` }}
                            />
                          )}
                          <span className="relative z-10 flex min-w-0 flex-col items-center gap-0.5 px-1 text-center">
                            <span className="flex items-center gap-2">
                              <span className="h-3 w-3 shrink-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                              {isManualSyncing || app.syncProgress === -1 ? (
                                <span className="max-w-[34px] truncate text-[9px] font-bold leading-tight">
                                  {app.syncStatus || 'Syncing…'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-black">{app.syncProgress}%</span>
                              )}
                            </span>
                            {app.syncStatus && app.syncProgress !== -1 ? (
                              <span className="hidden">
                                {app.syncStatus}
                              </span>
                            ) : null}
                          </span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                          </svg>
                          <span className="sr-only">Sync now</span>
                        </>
                      )}
                    </button>
                    <Link
                      to={`/app/${app.id}`}
                      title="Details"
                      aria-label="Details"
                      className={`${compactActionButton} border-blue-600 bg-blue-600 text-white hover:bg-blue-700 text-center shadow-md shadow-blue-900/20`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      <span className="sr-only">Details</span>
                    </Link>
                    <button
                      onClick={() => startEditing(app)}
                      title="Edit"
                      aria-label="Edit"
                      className={`${compactActionButton} ${theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      <span className="sr-only">Edit</span>
                    </button>
                    <button
                      onClick={() => removeApp(app.id)}
                      title="Remove"
                      aria-label="Remove"
                      className={`${compactActionButton} border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="sr-only">Remove</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            {app.proofWebViewLink && (
              <a
                href={app.proofWebViewLink}
                target="_blank"
                rel="noreferrer"
                title="View proof recording"
                aria-label="View proof recording"
                className={`flex h-9 items-center justify-center text-center text-[10px] font-black uppercase tracking-[0.2em] transition-all ${theme === 'dark' ? 'bg-emerald-950/30 text-emerald-500 hover:bg-emerald-900/40' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 6a2 2 0 012-2h7a2 2 0 012 2v1.59l3.3-2.48A1 1 0 0118 6v8a1 1 0 01-1.7.71L13 12.23V14a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
              </a>
            )}
          </article>
          )
        })}
        {filteredApps.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No applications found for this client</p>
          </div>
        )}
      </div>
      {message && (
        <div className={`fixed bottom-6 right-6 rounded-2xl px-6 py-4 text-sm font-bold shadow-2xl z-50 flex items-center gap-3 ${theme === 'dark' ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white text-slate-900 border border-slate-200'}`}>
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          {message}
        </div>
      )}
    </section>
  )
}

export default AppMonitorPage
