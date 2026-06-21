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

  const isDark = theme === 'dark'

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
        <h2 className="text-xl font-black">User Subscription Access</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(payload.users || []).map((user) => (
            <article key={user.id} className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{user.name}</p>
                  <p className={`text-xs font-semibold ${mutedText}`}>{user.email}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${user.subscription.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {user.subscription.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm font-bold md:grid-cols-2">
                <p>Plan: {user.subscription.plan?.name || user.accessPlan || 'Free'}</p>
                <p>Valid: {formatValidUntil(user.validUntil)}</p>
                <p>Lists: {user.subscription.usage.listCount} / {formatPlanLimit(user.subscription.limits.listLimit)}</p>
                <p>Storage: {user.subscription.usage.storageGbUsed} GB / {formatPlanLimit(user.subscription.limits.storageGb, ' GB')}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default AdminSubscriptionsPage
