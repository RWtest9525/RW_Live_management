import { useEffect, useMemo, useState } from 'react'
import usePortalStore from '../store/usePortalStore'
import { getAdminSubscriptions } from '../services/billingApi'
import { formatValidUntil } from '../utils/subscriptionAccess'
import { formatPlanLimit } from '../../shared/subscriptionPlans'

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
  const [payload, setPayload] = useState({ summary: null, payments: [], users: [] })
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [userTab, setUserTab] = useState('pending')

  const isDark = theme === 'dark'

  const handleUpdateStatus = async (userId, newStatus) => {
    if (!window.confirm(`Are you sure you want to change user status to ${newStatus}?`)) return
    try {
      const token = usePortalStore.getState().token || localStorage.getItem('rw_session_token')
      const response = await fetch('/api/data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'user', id: userId, status: newStatus })
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to update user status')
      }
      await loadData()
      alert(`User status updated to ${newStatus} successfully.`)
    } catch (error) {
      alert(error.message)
    }
  }

  const handleUpdatePlan = async (userId, planId) => {
    try {
      const token = usePortalStore.getState().token || localStorage.getItem('rw_session_token')
      const response = await fetch('/api/data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'user', id: userId, accessPlan: planId })
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to update plan')
      }
      await loadData()
      alert(`User plan updated to ${planId} successfully.`)
    } catch (error) {
      alert(error.message)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('WARNING: Are you sure you want to permanently delete this user and all their settings? This action is irreversible.')) return
    try {
      const token = usePortalStore.getState().token || localStorage.getItem('rw_session_token')
      const response = await fetch(`/api/data?type=user&id=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to delete user')
      }
      await loadData()
      alert('User deleted successfully.')
    } catch (error) {
      alert(error.message)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setMessage('')
    try {
      setPayload(await getAdminSubscriptions())
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredPayments = useMemo(() => {
    if (filter === 'all') return payload.payments || []
    if (filter === 'pending') {
      return (payload.payments || []).filter((payment) => ['clicked', 'created'].includes(payment.status))
    }
    return (payload.payments || []).filter((payment) => payment.status === filter)
  }, [payload.payments, filter])

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-lg font-black uppercase tracking-widest text-rose-500">Admins only</p>
      </div>
    )
  }

  const cardClass = `rounded-3xl border p-5 shadow-sm ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <section className="space-y-6 pb-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-500">Admin Billing</p>
          <h1 className={`mt-2 text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
            Manage Subscriptions
          </h1>
          <p className={`mt-2 text-sm font-semibold ${mutedText}`}>
            Track who clicked Buy Now, who paid, who failed, and which users currently have active access.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20"
        >
          Refresh
        </button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-bold text-rose-500">
          {message}
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
            <h2 className="text-xl font-black">Payment Activity</h2>
            <p className={`text-sm font-semibold ${mutedText}`}>Clicked means user opened Razorpay checkout but payment is not completed yet.</p>
          </div>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold ${isDark ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="pending">Clicked / Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
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
              {!loading && filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="7" className={`py-10 text-center text-sm font-bold ${mutedText}`}>
                    No payment records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200/20">
          <div>
            <h2 className="text-xl font-black">User Account Control Room</h2>
            <p className={`text-sm font-semibold ${mutedText}`}>Verify new signups, manage status, modify plans, or delete scammer accounts.</p>
          </div>
          <div className="flex rounded-xl bg-slate-800/40 p-1 border border-white/5">
            {[
              ['pending', 'Pending Verification', (payload.users || []).filter(u => u.status === 'pending').length],
              ['active', 'Active Accounts', (payload.users || []).filter(u => u.status === 'active').length],
              ['blocked', 'Rejected / Suspended', (payload.users || []).filter(u => ['rejected', 'deactivated'].includes(u.status)).length],
            ].map(([tabId, label, count]) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setUserTab(tabId)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition ${
                  userTab === tabId
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {userTab === 'pending' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {(payload.users || [])
                .filter((user) => user.status === 'pending')
                .map((user) => (
                  <article
                    key={user.id}
                    className={`rounded-2xl border p-5 transition hover:shadow-lg ${
                      isDark ? 'border-slate-800 bg-slate-950 hover:border-slate-700' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <p className="text-lg font-black">{user.name}</p>
                        <p className={`text-xs font-semibold ${mutedText}`}>{user.email}</p>
                        {user.phone ? <p className={`text-xs font-semibold ${mutedText}`}>{user.phone}</p> : null}
                      </div>
                      <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-500">
                        Pending Verification
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl bg-black/35 p-4 border border-white/5 space-y-3.5 text-sm font-semibold">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${mutedText} font-black uppercase tracking-widest`}>Account Type</span>
                        <span className={`rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-black uppercase text-violet-400 border border-violet-500/15`}>
                          {user.accountType || 'Personal'}
                        </span>
                      </div>
                      <div>
                        <span className={`block text-xs ${mutedText} font-black uppercase tracking-widest mb-1`}>Social Profile URL</span>
                        {user.socialProfile ? (
                          <a
                            href={user.socialProfile}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-blue-400 hover:underline break-all"
                          >
                            {user.socialProfile}
                          </a>
                        ) : (
                          <span className="text-xs italic text-slate-500">No profile provided</span>
                        )}
                      </div>
                      <div>
                        <span className={`block text-xs ${mutedText} font-black uppercase tracking-widest mb-1`}>Purpose of Access</span>
                        <p className="rounded-lg bg-white/[0.02] p-2.5 text-xs font-medium text-slate-300 italic border border-white/5 whitespace-pre-wrap">
                          {user.purpose || 'No description provided.'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(user.id, 'active')}
                        className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-black uppercase tracking-widest text-white shadow shadow-emerald-950 transition"
                      >
                        Approve User
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(user.id, 'rejected')}
                        className="flex-1 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 py-3 text-xs font-black uppercase tracking-widest text-rose-400 border border-rose-500/20 transition"
                      >
                        Reject User
                      </button>
                    </div>
                  </article>
                ))}
              {(payload.users || []).filter((u) => u.status === 'pending').length === 0 && (
                <div className={`col-span-2 py-10 text-center text-sm font-bold ${mutedText}`}>
                  No pending user verification requests found.
                </div>
              )}
            </div>
          )}

          {userTab === 'active' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {(payload.users || [])
                .filter((user) => user.status === 'active')
                .map((user) => (
                  <article
                    key={user.id}
                    className={`rounded-2xl border p-5 ${
                      isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <p className="text-lg font-black">{user.name}</p>
                        <p className={`text-xs font-semibold ${mutedText}`}>{user.email}</p>
                        {user.phone ? <p className={`text-xs font-semibold ${mutedText}`}>{user.phone}</p> : null}
                      </div>
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-500">
                        Active Account
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-xs font-bold md:grid-cols-2">
                      <p className="text-slate-300">Plan: <span className="text-white font-black">{user.subscription.plan?.name || user.accessPlan || 'Free'}</span></p>
                      <p className="text-slate-300">Valid: <span className="text-white font-black">{formatValidUntil(user.validUntil)}</span></p>
                      <p className="text-slate-300">Lists: <span className="text-white font-black">{user.subscription.usage.listCount} / {formatPlanLimit(user.subscription.limits.listLimit)}</span></p>
                      <p className="text-slate-300">Storage: <span className="text-white font-black">{user.subscription.usage.storageGbUsed} GB / {formatPlanLimit(user.subscription.limits.storageGb, ' GB')}</span></p>
                    </div>

                    <div className="mt-5 border-t border-slate-200/10 pt-4 space-y-4">
                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-widest ${mutedText} mb-1.5`}>Change Access Plan</label>
                        <select
                          value={user.accessPlan || 'free'}
                          onChange={(e) => handleUpdatePlan(user.id, e.target.value)}
                          className={`w-full rounded-xl border px-3 py-2 text-xs font-bold ${
                            isDark ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'
                          }`}
                        >
                          <option value="free">Free</option>
                          <option value="lifetime">Lifetime</option>
                          <option value="weekly_199">Starter Week (weekly_199)</option>
                          <option value="monthly_499">Growth Month (monthly_499)</option>
                          <option value="monthly_999">Pro Month (monthly_999)</option>
                          <option value="yearly_9999">Agency Year (yearly_9999)</option>
                        </select>
                      </div>

                      <div className="flex gap-3 justify-end items-center">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(user.id, 'deactivated')}
                          className="rounded-lg bg-amber-600/10 hover:bg-amber-600/20 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-amber-500 border border-amber-500/20 transition"
                        >
                          Deactivate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user.id)}
                          className="rounded-lg bg-rose-600/10 hover:bg-rose-600/20 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-rose-500 border border-rose-500/20 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              {(payload.users || []).filter((u) => u.status === 'active').length === 0 && (
                <div className={`col-span-2 py-10 text-center text-sm font-bold ${mutedText}`}>
                  No active users found.
                </div>
              )}
            </div>
          )}

          {userTab === 'blocked' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {(payload.users || [])
                .filter((user) => ['rejected', 'deactivated'].includes(user.status))
                .map((user) => (
                  <article
                    key={user.id}
                    className={`rounded-2xl border p-5 ${
                      isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <p className="text-lg font-black">{user.name}</p>
                        <p className={`text-xs font-semibold ${mutedText}`}>{user.email}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border ${
                        user.status === 'rejected'
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                          : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                      }`}>
                        {user.status}
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl bg-black/20 p-3.5 border border-white/5 space-y-2 text-xs font-semibold">
                      <p className="text-slate-400">Account Type: <span className="text-slate-200 font-bold">{user.accountType || 'Personal'}</span></p>
                      {user.socialProfile ? (
                        <p className="text-slate-400 truncate">Profile: <span className="text-slate-200 font-bold">{user.socialProfile}</span></p>
                      ) : null}
                    </div>

                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(user.id, 'active')}
                        className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow transition"
                      >
                        Re-Activate / Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user.id)}
                        className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow transition"
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </article>
                ))}
              {(payload.users || []).filter((u) => ['rejected', 'deactivated'].includes(u.status)).length === 0 && (
                <div className={`col-span-2 py-10 text-center text-sm font-bold ${mutedText}`}>
                  No rejected or deactivated users found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default AdminSubscriptionsPage
