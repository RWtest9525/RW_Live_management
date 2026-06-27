import { useState } from 'react'
import usePortalStore from '../store/usePortalStore'
import { createUserRequest } from '../services/authApi'
import { SUBSCRIPTION_PLANS } from '../../shared/subscriptionPlans'

const accessPlanOptions = [
  { value: 'free', label: 'Free - no portal access' },
  ...Object.values(SUBSCRIPTION_PLANS).map((plan) => ({
    value: plan.id,
    label: `${plan.name} - Rs ${plan.priceInr}`,
  })),
  { value: 'lifetime', label: 'Lifetime - unlimited' },
]
const accessPlanIds = new Set(accessPlanOptions.map((option) => option.value))

function WorkerPanelPage() {
  const users = usePortalStore((state) => state.users)
  const theme = usePortalStore((state) => state.theme)
  const currentUser = usePortalStore((state) => state.currentUser)
  const token = usePortalStore((state) => state.token)
  const loadInitialData = usePortalStore((state) => state.loadInitialData)
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [accessPlan, setAccessPlan] = useState('free')
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [message, setMessage] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const [editingUserId, setEditingUserId] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    accessPlan: 'free',
    telegramBotToken: '',
    telegramChatId: '',
  })

  const handleCreateUser = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      await createUserRequest({
        token,
        name,
        email,
        phone,
        password,
        accessPlan,
        telegramBotToken,
        telegramChatId,
      })
      setName('')
      setEmail('')
      setPhone('')
      setPassword('')
      setAccessPlan('free')
      setTelegramBotToken('')
      setTelegramChatId('')
      setShowAddForm(false)
      setMessage('User created successfully.')
      loadInitialData()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (user) => {
    setEditingUserId(user.id)
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      accessPlan: accessPlanIds.has(user.accessPlan) ? user.accessPlan : 'free',
      telegramBotToken: '',
      telegramChatId: '',
    })
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/data', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'user', id: editingUserId, ...editForm })
      })
      setEditingUserId(null)
      setMessage('User updated successfully.')
      loadInitialData()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleDeactivateUser = async (user) => {
    if (user.id === currentUser?.id) {
      setMessage("You cannot deactivate yourself.")
      return
    }
    const newStatus = user.status === 'deactivated' ? 'active' : 'deactivated'
    if (!window.confirm(`Are you sure you want to ${newStatus === 'deactivated' ? 'DEACTIVATE' : 'ACTIVATE'} this user?`)) return
    try {
      await fetch('/api/data', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'user', id: user.id, status: newStatus })
      })
      setMessage(`User ${newStatus === 'deactivated' ? 'deactivated' : 'activated'} successfully.`)
      loadInitialData()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (userId === currentUser?.id) {
      setMessage("You cannot delete yourself.")
      return
    }
    if (!window.confirm('Are you sure you want to PERMANENTLY DELETE this user?')) return
    try {
      await fetch(`/api/data?type=user&id=${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setMessage('User deleted successfully.')
      loadInitialData()
    } catch (error) {
      setMessage(error.message)
    }
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-lg font-bold text-rose-500 font-black uppercase tracking-widest animate-pulse">
          Access Denied. Admins only.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Worker Panel</h2>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Manage staff accounts and system access</p>
        </div>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => {
              setShowAddForm(!showAddForm)
              setEditingUserId(null)
            }}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all transform active:scale-95"
          >
            {showAddForm ? 'Cancel' : '+ Add New User'}
          </button>
        )}
      </div>

      {/* Pending User Approval Section */}
      {users.some(u => u.status === 'pending') && (
        <div className={`rounded-2xl border p-6 shadow-xl transition-all duration-300 animate-in fade-in zoom-in-95 ${
          theme === 'dark' ? 'border-amber-500/20 bg-amber-500/[0.02]' : 'border-amber-200 bg-amber-50/50'
        }`}>
          <div className="flex items-center gap-3 border-b pb-4 border-slate-200/20 mb-4">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
            <h3 className={`text-lg font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Pending User Registrations</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {users.filter(u => u.status === 'pending').map((pUser) => (
              <div key={pUser.id} className={`rounded-xl border p-5 flex flex-col justify-between gap-4 transition-all duration-300 ${
                theme === 'dark' ? 'border-slate-800 bg-slate-950 hover:border-slate-700' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}>
                <div>
                  <h4 className={`text-sm font-black ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{pUser.name}</h4>
                  <p className="text-xs font-semibold text-slate-500">{pUser.email}</p>
                  {pUser.phone && <p className="text-xs font-semibold text-slate-500">{pUser.phone}</p>}
                </div>
                <div className="flex gap-2.5">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/data', {
                          method: 'PUT',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({ type: 'user', id: pUser.id, status: 'active' })
                        })
                        if (!res.ok) throw new Error('Failed to approve user')
                        setMessage('Account approved successfully.')
                        loadInitialData()
                      } catch (err) {
                        setMessage(err.message)
                      }
                    }}
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow shadow-emerald-950 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/data', {
                          method: 'PUT',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({ type: 'user', id: pUser.id, status: 'rejected' })
                        })
                        if (!res.ok) throw new Error('Failed to reject user')
                        setMessage('Account rejected successfully.')
                        loadInitialData()
                      } catch (err) {
                        setMessage(err.message)
                      }
                    }}
                    className="flex-1 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 py-2.5 text-xs font-black uppercase tracking-widest text-rose-400 border border-rose-500/20 transition"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(showAddForm || editingUserId) && currentUser?.role === 'admin' && (
        <div className={`rounded-2xl border p-6 shadow-xl transition-all duration-300 animate-in fade-in zoom-in-95 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <h3 className={`mb-6 text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {editingUserId ? 'Edit Staff Account' : 'Create Staff Account'}
          </h3>
          <form onSubmit={editingUserId ? handleUpdateUser : handleCreateUser} className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label>
              <input
                value={editingUserId ? editForm.name : name}
                onChange={(e) => editingUserId ? setEditForm({...editForm, name: e.target.value}) : setName(e.target.value)}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                placeholder="Staff name"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
              <input
                type="email"
                value={editingUserId ? editForm.email : email}
                onChange={(e) => editingUserId ? setEditForm({...editForm, email: e.target.value}) : setEmail(e.target.value)}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                placeholder="email@example.com"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone Number</label>
              <input
                value={editingUserId ? editForm.phone : phone}
                onChange={(e) => editingUserId ? setEditForm({...editForm, phone: e.target.value}) : setPhone(e.target.value)}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                placeholder="Optional"
              />
            </div>
            {!editingUserId && (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
                <input
                  type="text"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                  placeholder="Temporary password"
                  required
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subscription Plan</label>
              <select
                value={editingUserId ? editForm.accessPlan : accessPlan}
                onChange={(e) => editingUserId ? setEditForm({...editForm, accessPlan: e.target.value}) : setAccessPlan(e.target.value)}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
              >
                {accessPlanOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Telegram Bot Token
              </label>
              <input
                type="password"
                value={editingUserId ? editForm.telegramBotToken : telegramBotToken}
                onChange={(e) =>
                  editingUserId
                    ? setEditForm({ ...editForm, telegramBotToken: e.target.value })
                    : setTelegramBotToken(e.target.value)
                }
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                placeholder={editingUserId ? 'Locked - leave blank to keep' : 'Optional user bot token'}
                autoComplete="new-password"
              />
              <p className="mt-1 text-[10px] font-bold text-slate-400">Locked field. Users cannot view this.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Telegram Chat ID
              </label>
              <input
                type="password"
                value={editingUserId ? editForm.telegramChatId : telegramChatId}
                onChange={(e) =>
                  editingUserId
                    ? setEditForm({ ...editForm, telegramChatId: e.target.value })
                    : setTelegramChatId(e.target.value)
                }
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                placeholder={editingUserId ? 'Locked - leave blank to keep' : 'Optional user chat ID'}
                autoComplete="new-password"
              />
              <p className="mt-1 text-[10px] font-bold text-slate-400">Monthly plans use this personal Telegram route.</p>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 active:scale-95 disabled:bg-blue-300"
              >
                {loading ? 'Processing...' : editingUserId ? 'Save Changes' : 'Create Account'}
              </button>
              {editingUserId && (
                <button
                  type="button"
                  onClick={() => setEditingUserId(null)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className={`rounded-2xl border shadow-lg overflow-hidden transition-all duration-300 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className={`${theme === 'dark' ? 'bg-slate-950 border-b border-slate-800' : 'bg-slate-50 border-b border-slate-200'}`}>
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Staff Member</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Plan & Status</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Validity</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {users.map((worker) => (
                <tr key={worker.id} className={`group transition-all ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center text-sm font-black shadow-md ${worker.status === 'BANNED' ? 'bg-rose-500 text-white' : theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        {worker.name.charAt(0)}
                      </div>
                      <div>
                        <span className={`text-sm font-bold block ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{worker.name}</span>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-medium text-slate-500">{worker.email}</span>
                          {worker.phone && (
                            <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">{worker.phone}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest w-fit ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                        {worker.accessPlan ?? worker.role ?? 'User'}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest w-fit ${
                        worker.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : worker.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          : worker.status === 'deactivated' || worker.status === 'BANNED'
                          ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      }`}>
                        {worker.status || 'active'}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest w-fit ${
                        worker.hasTelegramBotToken && worker.hasTelegramChatId
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        Telegram {worker.hasTelegramBotToken && worker.hasTelegramChatId ? 'Locked' : 'Missing'}
                      </span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {worker.validUntil ? (
                      <span className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${new Date(worker.validUntil) < new Date() ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                        {new Date(worker.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                        Lifetime Access
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEditing(worker)}
                        className={`rounded-lg p-2 transition-all ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-blue-400' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'}`}
                        title="Edit User"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleDeactivateUser(worker)}
                        className={`rounded-lg p-2 transition-all ${worker.status === 'deactivated' ? 'text-emerald-500 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}`}
                        title={worker.status === 'deactivated' ? 'Activate User' : 'Deactivate User'}
                      >
                        {worker.status === 'deactivated' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(worker.id)}
                        className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 transition-all"
                        title="Delete User"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No staff members found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

export default WorkerPanelPage
