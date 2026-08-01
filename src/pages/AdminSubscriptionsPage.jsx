import { useEffect, useMemo, useState } from 'react'
import usePortalStore from '../store/usePortalStore'
import { getAdminSubscriptions } from '../services/billingApi'

const statusClass = {
  paid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  clicked: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  created: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  failed: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
}

const formatDateTime = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function AdminSubscriptionsPage() {
  const theme = usePortalStore((state) => state.theme)
  const currentUser = usePortalStore((state) => state.currentUser)
  const isDark = theme === 'dark'

  const [activeTab, setActiveTab] = useState('api-keys') // 'api-keys' or 'billing'

  // Billing State
  const [payload, setPayload] = useState({ summary: null, payments: [], users: [] })
  const [filter, setFilter] = useState('all')
  const [loadingBilling, setLoadingBilling] = useState(true)
  const [billingMessage, setBillingMessage] = useState('')

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

  const loadBillingData = async () => {
    setLoadingBilling(true)
    setBillingMessage('')
    try {
      setPayload(await getAdminSubscriptions())
    } catch (error) {
      setBillingMessage(error.message)
    } finally {
      setLoadingBilling(false)
    }
  }

  const fetchApiKeys = async () => {
    setApiKeyLoading(true)
    try {
      const res = await fetch('/api/admin-client-keys')
      const data = await res.json()
      if (data.success) {
        setApiKeys(data.keys || [])
      }
    } catch (err) {
      console.error('Error loading API keys:', err)
    } finally {
      setApiKeyLoading(false)
    }
  }

  useEffect(() => {
    void loadBillingData()
    void fetchApiKeys()
  }, [])

  const filteredPayments = useMemo(() => {
    if (filter === 'all') return payload.payments || []
    if (filter === 'pending') {
      return (payload.payments || []).filter((payment) => ['clicked', 'created'].includes(payment.status))
    }
    return (payload.payments || []).filter((payment) => payment.status === filter)
  }, [payload.payments, filter])

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
        alert(`API Key generated for "${clientNameInput}"!`)
      } else {
        alert(data.error || 'Failed to generate API key')
      }
    } catch (err) {
      alert('Error generating API key')
    } finally {
      setSubmittingKey(false)
    }
  }

  const handleRenewKey = async (id, clientName) => {
    if (!window.confirm(`Renew subscription for "${clientName}" (+30 Days & reset limit)?`)) return
    try {
      const res = await fetch('/api/admin-client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renew', client_id: id })
      })
      const data = await res.json()
      if (data.success) {
        fetchApiKeys()
        alert(`Subscription renewed for "${clientName}"!`)
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
    if (!window.confirm(`Delete API Key for "${clientName}"?`)) return
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

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email?.toLowerCase() === 'reviewsworld01@gmail.com'

  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-lg font-black uppercase tracking-widest text-rose-500">Admins only</p>
      </div>
    )
  }

  const cardClass = `rounded-3xl border transition-all duration-300 p-6 shadow-md ${
    isDark ? 'border-slate-800 bg-slate-900/90 text-white' : 'border-slate-200 bg-white text-slate-900'
  }`

  const inputClass = `w-full rounded-xl border px-4 py-2.5 text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
  }`

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <section className="space-y-6 pb-16 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-500">Admin Control Center</p>
          <h1 className={`mt-1.5 text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
            Manage Subscriptions & Scraper API Keys
          </h1>
          <p className={`mt-1 text-sm font-semibold ${mutedText}`}>
            Generate client API keys, set request limits, renew subscriptions, and track user billing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void loadBillingData(); void fetchApiKeys(); }}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-3 border-b border-slate-700/40 pb-2">
        <button
          onClick={() => setActiveTab('api-keys')}
          className={`pb-2.5 text-xs font-black uppercase tracking-wider transition border-b-2 ${
            activeTab === 'api-keys' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🔑 Play Store Scraper API Keys & Client Subscriptions
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`pb-2.5 text-xs font-black uppercase tracking-wider transition border-b-2 ${
            activeTab === 'billing' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          💳 User Payment Activity & Razorpay Billing
        </button>
      </div>

      {/* TAB 1: SCRAPER API KEYS & SUBSCRIPTIONS */}
      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form to Generate API Key */}
            <div className={`lg:col-span-4 ${cardClass} h-fit`}>
              <h2 className={`text-base font-black uppercase tracking-wider mb-4 pb-3 border-b ${isDark ? 'border-slate-800 text-white' : 'border-slate-100 text-slate-900'}`}>
                Generate New API Key
              </h2>

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
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-3 font-black text-xs text-white uppercase tracking-widest shadow-lg transition"
                >
                  {submittingKey ? 'Generating...' : '⚡ Generate API Key'}
                </button>
              </form>
            </div>

            {/* API Keys List Table */}
            <div className={`lg:col-span-8 ${cardClass}`}>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/40">
                <h2 className={`text-base font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Client API Keys & Usage Limits
                </h2>
                <span className="text-xs font-bold text-slate-400">{apiKeys.length} Keys Total</span>
              </div>

              {apiKeyLoading ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading API keys...</div>
              ) : apiKeys.length === 0 ? (
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
                      {apiKeys.map((k) => {
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
                                  onClick={() => handleRenewKey(k.id, k.client_name)}
                                  className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg text-[10px] font-black transition border border-emerald-500/20"
                                >
                                  Renew
                                </button>
                                <button
                                  onClick={() => handleTogglePauseKey(k.id)}
                                  className="px-2 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white rounded-lg text-[10px] font-black transition border border-amber-500/20"
                                >
                                  {k.is_active ? 'Pause' : 'Resume'}
                                </button>
                                <button
                                  onClick={() => handleDeleteApiKey(k.id, k.client_name)}
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

          {/* Integration Instructions */}
          <div className={cardClass}>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2">💻 Share This Integration Code With Your Client</h3>
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

      {/* TAB 2: USER PAYMENT ACTIVITY */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {billingMessage ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-bold text-rose-500">
              {billingMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-5">
            {[
              ['Revenue', `Rs ${payload.summary?.revenueInr || 0}`],
              ['Paid', payload.summary?.paidPayments || 0],
              ['Pending Clicks', payload.summary?.pendingPayments || 0],
              ['Failed', payload.summary?.failedPayments || 0],
              ['Active Users', `${payload.summary?.activeUsers || 0}/${payload.summary?.totalUsers || 0}`],
            ].map(([label, value]) => (
              <div key={label} className={cardClass}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${mutedText}`}>{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>

          <div className={cardClass}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-black uppercase tracking-wider">Payment Activity</h2>
                <p className={`text-xs font-semibold ${mutedText}`}>Clicked means user opened Razorpay checkout but payment is not completed yet.</p>
              </div>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className={`rounded-xl border px-4 py-2 text-xs font-bold ${isDark ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
              >
                <option value="all">All Payments</option>
                <option value="paid">Paid</option>
                <option value="pending">Clicked / Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  <tr className="border-b border-slate-200/20">
                    <th className="py-3 pr-4 text-[10px] font-black uppercase tracking-widest">User</th>
                    <th className="py-3 pr-4 text-[10px] font-black uppercase tracking-widest">Plan</th>
                    <th className="py-3 pr-4 text-[10px] font-black uppercase tracking-widest">Amount</th>
                    <th className="py-3 pr-4 text-[10px] font-black uppercase tracking-widest">Status</th>
                    <th className="py-3 pr-4 text-[10px] font-black uppercase tracking-widest">Clicked At</th>
                    <th className="py-3 pr-4 text-[10px] font-black uppercase tracking-widest">Paid At</th>
                    <th className="py-3 pr-4 text-[10px] font-black uppercase tracking-widest">IDs / Reason</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="py-4 pr-4">
                        <p className="font-black">{payment.userName}</p>
                        <p className={`text-xs ${mutedText}`}>{payment.userEmail}</p>
                        <p className={`text-xs ${mutedText}`}>{payment.userPhone || '-'}</p>
                      </td>
                      <td className="py-4 pr-4 font-bold">{payment.planName}</td>
                      <td className="py-4 pr-4 font-black">Rs {payment.amountInr}</td>
                      <td className="py-4 pr-4">
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass[payment.status] || statusClass.clicked}`}>
                          {payment.status === 'clicked' ? 'clicked / pending' : payment.status}
                        </span>
                      </td>
                      <td className="py-4 pr-4">{formatDateTime(payment.createdAt)}</td>
                      <td className="py-4 pr-4">{formatDateTime(payment.paidAt)}</td>
                      <td className="py-4 pr-4">
                        <p className={`break-all text-xs font-mono ${mutedText}`}>Order: {payment.razorpayOrderId}</p>
                        {payment.razorpayPaymentId ? (
                          <p className={`break-all text-xs font-mono ${mutedText}`}>Pay: {payment.razorpayPaymentId}</p>
                        ) : null}
                        {payment.failureReason ? (
                          <p className="mt-1 text-xs font-bold text-rose-500">{payment.failureReason}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!loadingBilling && filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className={`py-10 text-center text-xs font-bold ${mutedText}`}>
                        No payment records found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}

export default AdminSubscriptionsPage
