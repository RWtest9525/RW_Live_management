import { useEffect, useState, useMemo } from 'react'
import usePortalStore from '../store/usePortalStore'

function ApiManagementPage() {
  const theme = usePortalStore((state) => state.theme)
  const isDark = theme === 'dark'

  const [keys, setKeys] = useState([])
  const [hfSpaceUrl, setHfSpaceUrl] = useState('https://yash9525-rw-live-checker.hf.space')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [activeTab, setActiveTab] = useState('keys') // 'keys', 'docs', 'hf'
  const [codeLanguage, setCodeLanguage] = useState('js') // 'js', 'curl', 'python'

  // Form State for generating API Key
  const [clientName, setClientName] = useState('')
  const [plan, setPlan] = useState('Monthly')
  const [limit, setLimit] = useState(5000)
  
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
      setMessage({ text: 'Error connecting to API keys service', type: 'error' })
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
        setMessage({ text: `API Key generated successfully for "${clientName}"!`, type: 'success' })
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

  const handleRenew = async (clientId, name) => {
    if (!window.confirm(`Renew subscription for "${name}" (+30 Days & reset usage limit)?`)) return
    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renew', client_id: clientId })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ text: `Subscription renewed for "${name}"!`, type: 'success' })
        fetchKeys()
      }
    } catch (err) {
      setMessage({ text: 'Error renewing subscription', type: 'error' })
    }
  }

  const handleTogglePause = async (clientId) => {
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

  const handleDelete = async (clientId, name) => {
    if (!window.confirm(`Permanently delete API Key for "${name}"?`)) return
    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', client_id: clientId })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ text: `Deleted API key for "${name}"`, type: 'success' })
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

  const cardClass = `rounded-3xl border transition-all duration-300 p-6 shadow-md ${
    isDark ? 'border-slate-800 bg-slate-900/90 text-white' : 'border-slate-200 bg-white text-slate-900'
  }`
  
  const inputClass = `w-full rounded-xl border px-4 py-2.5 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark ? 'border-slate-700 bg-slate-950 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'
  }`

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <section className="space-y-6 pb-16 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.25em] text-blue-500">Scraper API Control Center</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
            </span>
          </div>
          <h1 className={`mt-1.5 text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Play Store Scraper API & Client Keys
          </h1>
          <p className={`mt-1 text-sm font-medium ${mutedText}`}>
            Manage client subscriptions, generate API keys, set request limits, and renew access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchKeys}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
              isDark ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🔄 Refresh
          </button>
          
          <a
            href={`${hfSpaceUrl}/admin`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-900/20 transition"
          >
            <span>Python Admin UI ↗</span>
          </a>
        </div>
      </div>

      {/* Alert Message */}
      {message.text && (
        <div className={`p-4 rounded-2xl text-xs font-bold border flex items-center justify-between transition-all ${
          message.type === 'error' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ text: '', type: '' })} className="font-black px-2">✕</button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cardClass}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Clients</p>
          <p className="mt-2 text-3xl font-black text-blue-500">{stats.total}</p>
        </div>

        <div className={cardClass}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active API Keys</p>
          <p className="mt-2 text-3xl font-black text-emerald-500">{stats.active}</p>
        </div>

        <div className={cardClass}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Requests Consumed</p>
          <p className="mt-2 text-3xl font-black text-indigo-500">{stats.totalReqs.toLocaleString()}</p>
        </div>

        <div className={cardClass}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Expired / Inactive</p>
          <p className="mt-2 text-3xl font-black text-amber-500">{stats.inactive}</p>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex border-b border-slate-700/40 space-x-4 pb-2">
        <button
          onClick={() => setActiveTab('keys')}
          className={`pb-2.5 text-xs font-black uppercase tracking-wider transition border-b-2 ${
            activeTab === 'keys' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🔑 Client API Keys Management
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`pb-2.5 text-xs font-black uppercase tracking-wider transition border-b-2 ${
            activeTab === 'docs' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          📖 Client Integration Code
        </button>
        <button
          onClick={() => setActiveTab('hf')}
          className={`pb-2.5 text-xs font-black uppercase tracking-wider transition border-b-2 ${
            activeTab === 'hf' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🚀 Hugging Face Endpoint
        </button>
      </div>

      {/* TAB 1: CLIENT API KEYS MANAGEMENT */}
      {activeTab === 'keys' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Form Side Column */}
          <div className={`lg:col-span-4 ${cardClass} h-fit`}>
            <h2 className={`text-base font-black uppercase tracking-wider mb-4 pb-3 border-b ${isDark ? 'border-slate-800 text-white' : 'border-slate-100 text-slate-900'}`}>
              Generate New API Key
            </h2>

            <form onSubmit={handleGenerateKey} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Client Name</label>
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
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Subscription Plan</label>
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
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Monthly Request Limit</label>
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
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Expiry Date</label>
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
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-3 font-black text-xs text-white uppercase tracking-widest shadow-lg shadow-blue-900/20 transition active:scale-95"
              >
                {submitting ? 'Generating...' : '⚡ Generate API Key'}
              </button>
            </form>
          </div>

          {/* Table Main Column */}
          <div className={`lg:col-span-8 ${cardClass}`}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/40">
              <h2 className={`text-base font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Client Subscriptions & Keys
              </h2>
              <span className="text-xs font-bold text-slate-400">{keys.length} Total</span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading API keys...</div>
            ) : keys.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">🔑</div>
                <p className="text-xs font-black uppercase tracking-widest">No API Keys Generated Yet</p>
                <p className="text-xs mt-1 text-slate-500">Fill the form on the left to create your first client API key.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800/40">
                    <tr>
                      <th className="pb-3 px-2">Client</th>
                      <th className="pb-3 px-2">API Key</th>
                      <th className="pb-3 px-2">Usage Limit</th>
                      <th className="pb-3 px-2">Expiry</th>
                      <th className="pb-3 px-2 text-center">Status</th>
                      <th className="pb-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 font-semibold">
                    {keys.map((k) => {
                      const pct = Math.round((k.requests_used / k.request_limit) * 100)
                      const isExpired = new Date(k.expiry_date) < new Date()

                      return (
                        <tr key={k.id} className="hover:bg-slate-800/20 transition">
                          <td className="py-3 px-2">
                            <div className="font-bold text-slate-100">{k.client_name}</div>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">{k.subscription_plan}</span>
                          </td>

                          <td className="py-3 px-2 font-mono text-[11px]">
                            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg w-fit">
                              <span className="text-indigo-300">{k.api_key.slice(0, 10)}...{k.api_key.slice(-4)}</span>
                              <button onClick={() => copyToClipboard(k.api_key)} className="text-slate-400 hover:text-white ml-1">📋</button>
                            </div>
                          </td>

                          <td className="py-3 px-2 min-w-[120px]">
                            <div className="flex justify-between text-[11px] font-bold mb-1">
                              <span>{k.requests_used}/{k.request_limit}</span>
                              <span className={pct >= 100 ? 'text-rose-400' : pct >= 80 ? 'text-amber-400' : 'text-emerald-400'}>{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div
                                className={`h-1.5 transition-all ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3 px-2 text-[11px]">
                            <div className="font-bold text-slate-300">{new Date(k.expiry_date).toLocaleDateString()}</div>
                          </td>

                          <td className="py-3 px-2 text-center">
                            {isExpired ? (
                              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-black text-rose-400 border border-rose-500/20">Expired</span>
                            ) : !k.is_active ? (
                              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-400 border border-amber-500/20">Paused</span>
                            ) : k.requests_used >= k.request_limit ? (
                              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-black text-purple-400 border border-purple-500/20">Exhausted</span>
                            ) : (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-500/20">Active</span>
                            )}
                          </td>

                          <td className="py-3 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleRenew(k.id, k.client_name)}
                                className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg text-[10px] font-black transition border border-emerald-500/20"
                              >
                                Renew
                              </button>
                              <button
                                onClick={() => handleTogglePause(k.id)}
                                className="px-2 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white rounded-lg text-[10px] font-black transition border border-amber-500/20"
                              >
                                {k.is_active ? 'Pause' : 'Resume'}
                              </button>
                              <button
                                onClick={() => handleDelete(k.id, k.client_name)}
                                className="px-2 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg text-[10px] font-black transition border border-rose-500/20"
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

      {/* TAB 2: INTEGRATION GUIDE */}
      {activeTab === 'docs' && (
        <div className={cardClass}>
          <h2 className="text-lg font-black text-white mb-2">Third-Party Client Integration Snippets</h2>
          <p className={`text-xs ${mutedText} mb-4`}>
            Give your client their generated API key (`sk_live_...`) and these ready-to-use code snippets:
          </p>

          <div className="flex space-x-2 border-b border-slate-800 pb-2 mb-4">
            <button
              onClick={() => setCodeLanguage('js')}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${codeLanguage === 'js' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              JavaScript (Fetch)
            </button>
            <button
              onClick={() => setCodeLanguage('curl')}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${codeLanguage === 'curl' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              cURL
            </button>
            <button
              onClick={() => setCodeLanguage('python')}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${codeLanguage === 'python' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              Python (requests)
            </button>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl font-mono text-xs text-indigo-300 overflow-x-auto border border-slate-800">
            {codeLanguage === 'js' && (
`// JavaScript Client Integration
async function getPlayStoreReviews(appId = "com.instagram.android", count = 10) {
  const API_KEY = "sk_live_CLIENT_KEY_HERE";
  
  const response = await fetch("https://yash9525-rw-live-checker.hf.space/api/reviews?app_id=" + appId + "&count=" + count, {
    headers: { "X-API-KEY": API_KEY }
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
`curl -X GET "https://yash9525-rw-live-checker.hf.space/api/reviews?app_id=com.instagram.android&count=10" \\
     -H "X-API-KEY: sk_live_CLIENT_KEY_HERE"`
            )}

            {codeLanguage === 'python' && (
`import requests

API_KEY = "sk_live_CLIENT_KEY_HERE"
url = "https://yash9525-rw-live-checker.hf.space/api/reviews"

headers = {"X-API-KEY": API_KEY}
params = {"app_id": "com.whatsapp", "count": 10}

response = requests.get(url, headers=headers, params=params)
print(response.json())`
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HUGGING FACE BACKEND STATUS */}
      {activeTab === 'hf' && (
        <div className={cardClass}>
          <h2 className="text-lg font-black text-white mb-2">Hugging Face Live Endpoint</h2>
          <p className={`text-xs ${mutedText} mb-4`}>
            Your Python API engine is hosted on Hugging Face Spaces:
          </p>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Endpoint URL</p>
              <p className="text-xs font-mono font-bold text-indigo-400 mt-1">{hfSpaceUrl}</p>
            </div>
            <a
              href={`${hfSpaceUrl}/admin`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition"
            >
              Native Admin Portal ↗
            </a>
          </div>
        </div>
      )}

    </section>
  )
}

export default ApiManagementPage
