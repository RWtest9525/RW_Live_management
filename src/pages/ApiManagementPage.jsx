import { useEffect, useState, useMemo } from 'react'
import usePortalStore from '../store/usePortalStore'

function ApiManagementPage() {
  const theme = usePortalStore((state) => state.theme)
  const currentUser = usePortalStore((state) => state.currentUser)
  const isDark = theme === 'dark'

  const [keys, setKeys] = useState([])
  const [hfSpaceUrl, setHfSpaceUrl] = useState('https://yash9525-rw-live-checker.hf.space')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [activeTab, setActiveTab] = useState('keys') // 'keys', 'docs', 'hf'
  const [codeLanguage, setCodeLanguage] = useState('js') // 'js', 'curl', 'python', 'node'

  // Form State for generating API Key
  const [clientName, setClientName] = useState('')
  const [plan, setPlan] = useState('Monthly')
  const [limit, setLimit] = useState(5000)
  
  // Default expiry date: 30 days from today
  const defaultExpiry = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  }, [])

  const [expiryDate, setExpiryDate] = useState(defaultExpiry)
  const [submitting, setSubmitting] = useState(false)

  // Fetch client keys from API
  const fetchKeys = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin-client-keys')
      const data = await res.json()
      if (data.success) {
        setKeys(data.keys || [])
        if (data.hf_space_url) setHfSpaceUrl(data.hf_space_url)
      } else {
        setMessage({ text: data.error || 'Failed to fetch API keys', type: 'error' })
      }
    } catch (err) {
      console.error('Error loading API keys:', err)
      setMessage({ text: 'Error connecting to backend API', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchKeys()
  }, [])

  // Action Handlers
  const handleGenerateKey = async (e) => {
    e.preventDefault()
    if (!clientName.trim()) return

    setSubmitting(true)
    setMessage({ text: '', type: '' })

    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          client_name: clientName,
          subscription_plan: plan,
          request_limit: limit,
          expiry_date: expiryDate
        })
      })

      const data = await res.json()
      if (data.success) {
        setMessage({ text: `API Key generated for ${clientName}!`, type: 'success' })
        setClientName('')
        setLimit(5000)
        setExpiryDate(defaultExpiry)
        fetchKeys()
      } else {
        setMessage({ text: data.error || 'Failed to generate API Key', type: 'error' })
      }
    } catch (err) {
      setMessage({ text: 'Network error generating API key', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRenew = async (clientId, clientName) => {
    if (!window.confirm(`Renew subscription for ${clientName} (+30 Days & reset limit)?`)) return
    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renew', client_id: clientId })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ text: `Subscription renewed for ${clientName}!`, type: 'success' })
        fetchKeys()
      }
    } catch (err) {
      setMessage({ text: 'Error renewing subscription', type: 'error' })
    }
  }

  const handleTogglePause = async (clientId, currentStatus) => {
    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-pause', client_id: clientId })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ text: data.message, type: 'success' })
        fetchKeys()
      }
    } catch (err) {
      setMessage({ text: 'Error toggling key status', type: 'error' })
    }
  }

  const handleDelete = async (clientId, clientName) => {
    if (!window.confirm(`Are you sure you want to permanently delete API Key for ${clientName}?`)) return
    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', client_id: clientId })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ text: `Deleted API key for ${clientName}`, type: 'success' })
        fetchKeys()
      }
    } catch (err) {
      setMessage({ text: 'Error deleting key', type: 'error' })
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('API Key copied to clipboard!')
  }

  // Admin access guard
  const isAdmin = currentUser?.role === 'admin' || currentUser?.email?.toLowerCase() === 'reviewsworld01@gmail.com'

  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-lg font-black uppercase tracking-widest text-rose-500">Super Admin Access Only</p>
      </div>
    )
  }

  // Stats calculation
  const stats = useMemo(() => {
    const total = keys.length
    let active = 0
    let totalReqs = 0
    let inactive = 0

    keys.forEach((k) => {
      totalReqs += k.requests_used || 0
      const isExpired = new Date(k.expiry_date) < new Date()
      if (k.is_active && !isExpired && k.requests_used < k.request_limit) {
        active += 1
      } else {
        inactive += 1
      }
    })

    return { total, active, inactive, totalReqs }
  }, [keys])

  const cardClass = `rounded-3xl border p-6 shadow-sm ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`
  const inputClass = `w-full rounded-xl border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
  }`
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <section className="space-y-8 pb-16">
      
      {/* Header Banner */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase tracking-[0.25em] text-blue-500">Scraper API Control Panel</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Super Admin
            </span>
          </div>
          <h1 className={`mt-2 text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
            Play Store Scraper API & Client Keys
          </h1>
          <p className={`mt-2 text-sm font-medium ${mutedText}`}>
            Manage client subscriptions, generate API keys, track request limits, and renew expired accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchKeys}
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh Data
          </button>
          
          <a
            href={`${hfSpaceUrl}/admin`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:from-blue-500 hover:to-indigo-500 shadow-md transition"
          >
            <span>Open Python Admin UI</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        </div>
      </div>

      {/* Message Alert */}
      {message.text && (
        <div className={`p-4 rounded-2xl text-sm font-semibold border flex items-center justify-between ${
          message.type === 'error' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ text: '', type: '' })} className="font-bold">✕</button>
        </div>
      )}

      {/* Metrics Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cardClass}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Clients</p>
          <p className="mt-2 text-3xl font-black text-blue-500">{stats.total}</p>
        </div>

        <div className={cardClass}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active API Keys</p>
          <p className="mt-2 text-3xl font-black text-emerald-500">{stats.active}</p>
        </div>

        <div className={cardClass}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Requests Used</p>
          <p className="mt-2 text-3xl font-black text-indigo-500">{stats.totalReqs.toLocaleString()}</p>
        </div>

        <div className={cardClass}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Expired / Inactive</p>
          <p className="mt-2 text-3xl font-black text-amber-500">{stats.inactive}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-700/60 space-x-6">
        <button
          onClick={() => setActiveTab('keys')}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === 'keys' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          🔑 Client API Keys Management
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === 'docs' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          📖 Integration Guide & API Docs
        </button>
        <button
          onClick={() => setActiveTab('hf')}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === 'hf' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          🚀 Hugging Face Backend Status
        </button>
      </div>

      {/* TAB 1: CLIENT API KEYS MANAGEMENT */}
      {activeTab === 'keys' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form to Generate API Key */}
          <div className={cardClass}>
            <h2 className={`text-lg font-black tracking-tight mb-4 pb-3 border-b border-slate-800 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Generate New API Key
            </h2>

            <form onSubmit={handleGenerateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Client Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp / John Doe"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Subscription Plan</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className={inputClass}
                >
                  <option value="Monthly">Monthly Plan</option>
                  <option value="Custom">Custom Enterprise Plan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Monthly Request Limit</label>
                <input
                  type="number"
                  required
                  min="100"
                  step="500"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Expiry Date</label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-3 font-black text-white shadow-lg transition"
              >
                {submitting ? 'Generating...' : '⚡ Generate API Key'}
              </button>
            </form>
          </div>

          {/* Active Clients List Table */}
          <div className={`lg:col-span-2 ${cardClass}`}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h2 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Client API Keys & Subscriptions
              </h2>
              <span className="text-xs font-bold text-slate-400">{keys.length} Total</span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400">Loading API keys...</div>
            ) : keys.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-medium">
                No API keys generated yet. Create one using the form.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs font-black uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="pb-3 px-3">Client</th>
                      <th className="pb-3 px-3">API Key</th>
                      <th className="pb-3 px-3">Usage Progress</th>
                      <th className="pb-3 px-3">Expiry Date</th>
                      <th className="pb-3 px-3 text-center">Status</th>
                      <th className="pb-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {keys.map((k) => {
                      const pct = Math.round((k.requests_used / k.request_limit) * 100)
                      const isExpired = new Date(k.expiry_date) < new Date()

                      return (
                        <tr key={k.id} className="hover:bg-slate-800/20 transition">
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-white">{k.client_name}</div>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{k.subscription_plan}</span>
                          </td>

                          <td className="py-3.5 px-3 font-mono text-xs">
                            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg w-fit">
                              <span className="text-indigo-300">{k.api_key.slice(0, 10)}...{k.api_key.slice(-4)}</span>
                              <button onClick={() => copyToClipboard(k.api_key)} className="text-slate-400 hover:text-white ml-1">📋</button>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 min-w-[140px]">
                            <div className="flex justify-between text-xs font-bold mb-1">
                              <span>{k.requests_used} / {k.request_limit}</span>
                              <span className={pct >= 100 ? 'text-rose-400' : pct >= 80 ? 'text-amber-400' : 'text-emerald-400'}>{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                              <div
                                className={`h-2 transition-all ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-emerald-400'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-xs">
                            <div className="font-bold text-slate-200">{new Date(k.expiry_date).toLocaleDateString()}</div>
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            {isExpired ? (
                              <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-500 border border-rose-500/20">Expired</span>
                            ) : !k.is_active ? (
                              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-500 border border-amber-500/20">Paused</span>
                            ) : k.requests_used >= k.request_limit ? (
                              <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-bold text-purple-500 border border-purple-500/20">Limit Reached</span>
                            ) : (
                              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-500 border border-emerald-500/20">Active</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleRenew(k.id, k.client_name)}
                                title="Renew +30 Days"
                                className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition border border-emerald-500/20"
                              >
                                Renew
                              </button>
                              <button
                                onClick={() => handleTogglePause(k.id, k.is_active)}
                                title={k.is_active ? 'Pause' : 'Resume'}
                                className="px-2 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-bold transition border border-amber-500/20"
                              >
                                {k.is_active ? 'Pause' : 'Resume'}
                              </button>
                              <button
                                onClick={() => handleDelete(k.id, k.client_name)}
                                title="Delete"
                                className="px-2 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-bold transition border border-rose-500/20"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INTEGRATION GUIDE & DOCUMENTATION */}
      {activeTab === 'docs' && (
        <div className="space-y-6">
          <div className={cardClass}>
            <h2 className="text-xl font-black text-white mb-2">How to Share API Access with Third-Party Websites</h2>
            <p className={`text-sm ${mutedText}`}>
              Provide your client with their generated API key (`sk_live_...`) and direct them to include the header `X-API-KEY` in their HTTP requests.
            </p>

            <div className="mt-6 flex space-x-3 border-b border-slate-800 pb-3">
              <button
                onClick={() => setCodeLanguage('js')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${codeLanguage === 'js' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                JavaScript (Fetch)
              </button>
              <button
                onClick={() => setCodeLanguage('curl')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${codeLanguage === 'curl' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                cURL
              </button>
              <button
                onClick={() => setCodeLanguage('python')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${codeLanguage === 'python' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                Python (requests)
              </button>
            </div>

            <div className="mt-4 bg-slate-950 p-4 rounded-2xl font-mono text-xs text-indigo-300 overflow-x-auto border border-slate-800">
              {codeLanguage === 'js' && (
`// JavaScript Client Integration
async function getPlayStoreReviews(appId = "com.instagram.android", count = 10) {
  const API_KEY = "sk_live_CLIENT_KEY_HERE";
  
  const response = await fetch("https://yash9525-rw-live-checker.hf.space/api/reviews?app_id=" + appId + "&count=" + count, {
    headers: {
      "X-API-KEY": API_KEY
    }
  });

  const data = await response.json();
  if (response.status === 200) {
    console.log("Reviews:", data.reviews);
  } else {
    console.error("API Error:", data.message);
  }
}`
              )}

              {codeLanguage === 'curl' && (
`# cURL Command Line Call
curl -X GET "https://yash9525-rw-live-checker.hf.space/api/reviews?app_id=com.instagram.android&count=10" \\
     -H "X-API-KEY: sk_live_CLIENT_KEY_HERE"`
              )}

              {codeLanguage === 'python' && (
`# Python Request Call
import requests

API_KEY = "sk_live_CLIENT_KEY_HERE"
url = "https://yash9525-rw-live-checker.hf.space/api/reviews"

headers = {"X-API-KEY": API_KEY}
params = {"app_id": "com.whatsapp", "count": 10}

response = requests.get(url, headers=headers, params=params)
print(response.json())`
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HUGGING FACE BACKEND STATUS */}
      {activeTab === 'hf' && (
        <div className={cardClass}>
          <h2 className="text-xl font-black text-white mb-2">Hugging Face Space API Endpoint</h2>
          <p className={`text-sm ${mutedText} mb-4`}>
            Your Python backend application is deployed live on Hugging Face Spaces:
          </p>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400">Space Base URL</p>
              <p className="text-sm font-mono font-bold text-indigo-400 mt-1">{hfSpaceUrl}</p>
            </div>
            <a
              href={`${hfSpaceUrl}/admin`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition"
            >
              Open Native Admin Dashboard ↗
            </a>
          </div>
        </div>
      )}

    </section>
  )
}

export default ApiManagementPage
