import { useState, useEffect, useMemo } from 'react'
import usePortalStore from '../store/usePortalStore'
import { createClientRecord, deleteClientRecord, updateClientRecord } from '../services/portalApi'
import { Link } from 'react-router-dom'

function ClientManagementPage() {
  const clients = usePortalStore((state) => state.clients)
  const theme = usePortalStore((state) => state.theme)
  const currentUser = usePortalStore((state) => state.currentUser)
  const loadInitialData = usePortalStore((state) => state.loadInitialData)
  
  const [activeTab, setActiveTab] = useState('api-keys') // 'api-keys' or 'records'
  
  // Standard Client Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showClientModal, setShowClientModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Scraper API Keys State
  const [apiKeys, setApiKeys] = useState([])
  const [apiKeyLoading, setApiKeyLoading] = useState(false)
  const [clientNameInput, setClientNameInput] = useState('')
  const [planInput, setPlanInput] = useState('Monthly')
  const [limitInput, setLimitInput] = useState(5000)
  
  const defaultExpiry = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  }, [])
  const [expiryInput, setExpiryInput] = useState(defaultExpiry)
  const [submittingKey, setSubmittingKey] = useState(false)
  const [codeLang, setCodeLang] = useState('js')

  // Load API Keys
  const fetchApiKeys = async () => {
    setApiKeyLoading(true)
    try {
      const res = await fetch('/api/admin-client-keys')
      const data = await res.json()
      if (data.success) {
        setApiKeys(data.keys || [])
      }
    } catch (err) {
      console.error('Error fetching API keys:', err)
    } finally {
      setApiKeyLoading(false)
    }
  }

  useEffect(() => {
    void fetchApiKeys()
  }, [])

  const handleAddOrUpdateClient = async (e) => {
    e.preventDefault()
    if (!name || !currentUser) return
    setLoading(true)
    setMessage('Processing...')
    try {
      if (editingId) {
        await updateClientRecord(editingId, { name, email, phone })
        setMessage('Client updated successfully')
      } else {
        await createClientRecord({ 
          name, 
          email, 
          phone, 
          ownerUserId: currentUser.id 
        })
        setMessage(`Client "${name}" added successfully and Drive folder triggered.`)
      }
      setName('')
      setEmail('')
      setPhone('')
      setEditingId(null)
      setShowClientModal(false)
      await loadInitialData()
    } catch (err) {
      setMessage('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (client) => {
    setEditingId(client.id)
    setName(client.name)
    setEmail(client.email || '')
    setPhone(client.phone || '')
    setShowClientModal(true)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setName('')
    setEmail('')
    setPhone('')
    setShowClientModal(false)
  }

  const handleDeleteClient = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return
    try {
      await deleteClientRecord(id)
      loadInitialData()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  // API Key Action Handlers
  const handleGenerateApiKey = async (e) => {
    e.preventDefault()
    if (!clientNameInput.trim()) return

    setSubmittingKey(true)
    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          client_name: clientNameInput,
          subscription_plan: planInput,
          request_limit: limitInput,
          expiry_date: expiryInput
        })
      })
      const data = await res.json()
      if (data.success) {
        setClientNameInput('')
        setLimitInput(5000)
        setExpiryInput(defaultExpiry)
        fetchApiKeys()
        alert(`API Key generated for ${clientNameInput}!`)
      } else {
        alert(data.error || 'Failed to generate API Key')
      }
    } catch (err) {
      alert('Error generating API key')
    } finally {
      setSubmittingKey(false)
    }
  }

  const handleRenewKey = async (id, clientName) => {
    if (!window.confirm(`Renew subscription for ${clientName} (+30 Days & reset limit)?`)) return
    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renew', client_id: id })
      })
      const data = await res.json()
      if (data.success) {
        fetchApiKeys()
        alert(`Subscription renewed for ${clientName}!`)
      }
    } catch (err) {
      alert('Error renewing subscription')
    }
  }

  const handleTogglePauseKey = async (id) => {
    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-pause', client_id: id })
      })
      const data = await res.json()
      if (data.success) {
        fetchApiKeys()
      }
    } catch (err) {
      alert('Error toggling key')
    }
  }

  const handleDeleteApiKey = async (id, clientName) => {
    if (!window.confirm(`Delete API Key for ${clientName}?`)) return
    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', client_id: id })
      })
      const data = await res.json()
      if (data.success) {
        fetchApiKeys()
      }
    } catch (err) {
      alert('Error deleting key')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('API Key copied to clipboard!')
  }

  const isDark = theme === 'dark'
  const cardClass = `rounded-3xl border p-6 shadow-xl ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`
  const inputClass = `w-full rounded-xl border px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
  }`

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-5">
          <Link to="/dashboard" className={`rounded-full p-3 transition-all transform active:scale-90 ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <div>
            <h2 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Client Management</h2>
            <p className={`text-sm font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Manage Client Folders & Scraper API Subscriptions
            </p>
          </div>
        </div>

        {activeTab === 'records' && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setName('')
              setEmail('')
              setPhone('')
              setShowClientModal(true)
            }}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-700 active:scale-95"
          >
            + Add Client
          </button>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex space-x-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('api-keys')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'api-keys'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
              : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          🔑 Play Store Scraper API Keys & Subscriptions
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'records'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
              : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          👥 Client Details & Contact Info
        </button>
      </div>

      {/* TAB 1: SCRAPER API KEYS & SUBSCRIPTIONS */}
      {activeTab === 'api-keys' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Generate Key Form */}
            <div className={cardClass}>
              <h3 className={`text-lg font-black tracking-tight mb-4 pb-3 border-b border-slate-800 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Generate New API Key
              </h3>
              <form onSubmit={handleGenerateApiKey} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp / John Doe"
                    value={clientNameInput}
                    onChange={(e) => setClientNameInput(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Subscription Plan</label>
                  <select
                    value={planInput}
                    onChange={(e) => {
                      const selectedPlan = e.target.value
                      setPlanInput(selectedPlan)
                      const now = new Date()
                      if (selectedPlan === 'Weekly') {
                        setLimitInput(200)
                        now.setDate(now.getDate() + 7)
                      } else if (selectedPlan === 'Enterprise') {
                        setLimitInput(999999999)
                        now.setDate(now.getDate() + 365)
                      } else {
                        setLimitInput(1000)
                        now.setDate(now.getDate() + 30)
                      }
                      setExpiryInput(now.toISOString().split('T')[0])
                    }}
                    className={inputClass}
                  >
                    <option value="Weekly">Weekly Plan (₹199 - 200 Fetch Calls / 7 Days)</option>
                    <option value="Monthly">Monthly Plan (₹999 - 1000 Fetch Calls / 30 Days)</option>
                    <option value="Enterprise">Enterprise Plan (₹10,000 - Unlimited / 365 Days)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">API Request Fetch Limit</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="100"
                    value={limitInput}
                    onChange={(e) => setLimitInput(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">1 limit = 1 API fetch call to /api/reviews.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={expiryInput}
                    onChange={(e) => setExpiryInput(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingKey}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-3 font-black text-white shadow-lg transition text-xs uppercase tracking-wider"
                >
                  {submittingKey ? 'Generating...' : '⚡ Generate API Key'}
                </button>
              </form>
            </div>

            {/* API Keys Table */}
            <div className={`lg:col-span-2 ${cardClass}`}>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <h3 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Generated API Keys & Usage Status
                </h3>
                <span className="text-xs font-bold text-slate-400">{apiKeys.length} Keys Total</span>
              </div>

              {apiKeyLoading ? (
                <div className="py-12 text-center text-slate-400">Loading API keys...</div>
              ) : apiKeys.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold uppercase tracking-wider text-xs">
                  No API Keys generated yet. Create one using the form on the left.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="pb-3 px-3">Client</th>
                        <th className="pb-3 px-3">API Key</th>
                        <th className="pb-3 px-3">Usage</th>
                        <th className="pb-3 px-3">Expiry Date</th>
                        <th className="pb-3 px-3 text-center">Status</th>
                        <th className="pb-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {apiKeys.map((k) => {
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

                            <td className="py-3.5 px-3 min-w-[130px]">
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
                                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-500 border border-rose-500/20">Expired</span>
                              ) : !k.is_active ? (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-500 border border-amber-500/20">Paused</span>
                              ) : k.requests_used >= k.request_limit ? (
                                <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-500 border border-purple-500/20">Limit Reached</span>
                              ) : (
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-500 border border-emerald-500/20">Active</span>
                              )}
                            </td>

                            <td className="py-3.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleRenewKey(k.id, k.client_name)}
                                  className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition border border-emerald-500/20"
                                >
                                  Renew
                                </button>
                                <button
                                  onClick={() => handleTogglePauseKey(k.id)}
                                  className="px-2 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-bold transition border border-amber-500/20"
                                >
                                  {k.is_active ? 'Pause' : 'Resume'}
                                </button>
                                <button
                                  onClick={() => handleDeleteApiKey(k.id, k.client_name)}
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

          {/* Quick Integration Instructions */}
          <div className={cardClass}>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 mb-2">💻 Share This Integration Code With Your Client</h4>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setCodeLang('js')} className={`px-3 py-1 rounded-lg text-xs font-bold ${codeLang === 'js' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>JavaScript</button>
              <button onClick={() => setCodeLang('curl')} className={`px-3 py-1 rounded-lg text-xs font-bold ${codeLang === 'curl' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>cURL</button>
              <button onClick={() => setCodeLang('python')} className={`px-3 py-1 rounded-lg text-xs font-bold ${codeLang === 'python' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Python</button>
            </div>
            <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto">
              {codeLang === 'js' && `// Client Website Integration
fetch("https://yash9525-rw-live-checker.hf.space/api/reviews?app_id=com.instagram.android&count=10", {
  headers: { "X-API-KEY": "sk_live_YOUR_CLIENT_KEY" }
})
.then(res => res.json())
.then(data => console.log(data.reviews));`}
              {codeLang === 'curl' && `curl -X GET "https://yash9525-rw-live-checker.hf.space/api/reviews?app_id=com.instagram.android&count=10" \\
     -H "X-API-KEY: sk_live_YOUR_CLIENT_KEY"`}
              {codeLang === 'python' && `import requests
res = requests.get("https://yash9525-rw-live-checker.hf.space/api/reviews", 
                   headers={"X-API-KEY": "sk_live_YOUR_CLIENT_KEY"},
                   params={"app_id": "com.instagram.android", "count": 10})
print(res.json())`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 2: CLIENT DETAILS & CONTACT INFO (Original) */}
      {activeTab === 'records' && (
        <div className={`rounded-3xl border shadow-xl overflow-hidden transition-all duration-300 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className={`${isDark ? 'bg-slate-950 border-b border-slate-800' : 'bg-slate-50 border-b border-slate-200'}`}>
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Client Details</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Contact Info</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {clients.map((client) => (
                  <tr key={client.id} className={`group transition-all ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-8 py-5">
                      <span className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                        {client.name}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{client.email || '-'}</span>
                        <span className="text-[10px] font-bold text-slate-500">{client.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-8 py-5 text-right">
                      <div className="flex justify-end gap-1.5 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(client)}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${isDark ? 'border-slate-600 bg-slate-800 text-blue-400 hover:bg-blue-600 hover:text-white' : 'border-slate-200 bg-white text-blue-600 hover:bg-blue-600 hover:text-white'}`}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClient(client.id)}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${isDark ? 'border-slate-600 bg-slate-800 text-rose-400 hover:bg-rose-600 hover:text-white' : 'border-slate-200 bg-white text-rose-600 hover:bg-rose-600 hover:text-white'}`}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-8 py-20 text-center">
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No clients registered yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}

export default ClientManagementPage
