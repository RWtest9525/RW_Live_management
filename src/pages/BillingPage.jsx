import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'
import {
  createBillingOrder,
  getBillingStatus,
  loadRazorpayCheckout,
  markBillingPaymentFailed,
  verifyBillingPayment,
} from '../services/billingApi'
import { formatPlanLimit } from '../../shared/subscriptionPlans'
import { formatValidUntil } from '../utils/subscriptionAccess'

function BillingPage() {
  const theme = usePortalStore((state) => state.theme)
  const currentUser = usePortalStore((state) => state.currentUser)
  const setCurrentUser = usePortalStore((state) => state.setCurrentUser)
  const refreshCurrentUser = usePortalStore((state) => state.refreshCurrentUser)
  const [plans, setPlans] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [razorpayKeyId, setRazorpayKeyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [buyingPlanId, setBuyingPlanId] = useState('')
  const [message, setMessage] = useState('')

  const isDark = theme === 'dark'

  const activePlanId = subscription?.plan?.id ?? currentUser?.accessPlan
  const usage = subscription?.usage ?? { listCount: 0, storageGbUsed: 0 }
  const limits = subscription?.limits ?? {}

  const orderedPlans = useMemo(
    () => [...plans].sort((a, b) => Number(a.priceInr) - Number(b.priceInr)),
    [plans],
  )

  const loadStatus = async () => {
    setLoading(true)
    try {
      const payload = await getBillingStatus()
      setPlans(payload.plans || [])
      setSubscription(payload.subscription || null)
      setRazorpayKeyId(payload.razorpayKeyId || '')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  if (currentUser?.role === 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  const handleBuyPlan = async (planId) => {
    setBuyingPlanId(planId)
    setMessage('')

    try {
      await loadRazorpayCheckout()
      const order = await createBillingOrder(planId)
      const checkoutKey = order.keyId || razorpayKeyId
      if (!checkoutKey) throw new Error('Razorpay public key missing. Please check server setup.')

      const razorpay = new window.Razorpay({
        key: checkoutKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Reviews World',
        description: `${order.plan.name} subscription`,
        order_id: order.orderId,
        prefill: {
          name: order.user?.name || currentUser?.name || '',
          email: order.user?.email || currentUser?.email || '',
          contact: order.user?.phone || currentUser?.phone || '',
        },
        notes: {
          planId: order.plan.id,
        },
        theme: {
          color: '#2563eb',
        },
        handler: async (paymentResponse) => {
          const verified = await verifyBillingPayment(paymentResponse)
          if (verified.user) {
            setCurrentUser(verified.user)
          } else {
            await refreshCurrentUser()
          }
          setSubscription(verified.subscription || null)
          setMessage('Payment successful. Your plan is active now.')
          setBuyingPlanId('')
        },
        modal: {
          ondismiss: () => {
            setBuyingPlanId('')
          },
        },
      })

      razorpay.on('payment.failed', (response) => {
        const description = response?.error?.description || 'Payment failed. Please try again.'
        void markBillingPaymentFailed({
          orderId: order.orderId,
          paymentId: response?.error?.metadata?.payment_id || null,
          reason: description,
        }).catch(() => {})
        setMessage(description)
        setBuyingPlanId('')
      })

      razorpay.open()
    } catch (error) {
      setMessage(error.message)
      setBuyingPlanId('')
    }
  }

  return (
    <section className="space-y-4 pb-8">
      <div className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${isDark ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-500">Billing</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Choose your Reviews World plan</h1>
            <p className={`mt-1 max-w-2xl text-xs font-semibold sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Buy a plan to unlock app monitoring, list making, proof recordings, Drive-ready gallery links, and client reporting.
            </p>
          </div>

          <div className={`rounded-2xl border px-4 py-3 text-sm ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Access</p>
            <p className="mt-1 text-base font-black">{subscription?.plan?.name || 'No active plan'}</p>
            <p className="text-xs font-bold text-slate-500">Valid until: {formatValidUntil(subscription?.validUntil)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className={`rounded-2xl p-3 sm:p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lists Used</p>
            <p className="mt-1 text-lg font-black sm:text-2xl">
              {usage.listCount} / {formatPlanLimit(limits.listLimit)}
            </p>
          </div>
          <div className={`rounded-2xl p-3 sm:p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recording Storage</p>
            <p className="mt-1 text-lg font-black sm:text-2xl">
              {usage.storageGbUsed} GB / {formatPlanLimit(limits.storageGb, ' GB')}
            </p>
          </div>
          <div className={`rounded-2xl p-3 sm:p-4 ${subscription?.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest">Status</p>
            <p className="mt-1 text-lg font-black sm:text-2xl">{subscription?.active ? 'Active' : 'Payment Required'}</p>
          </div>
        </div>
      </div>

      {message ? (
        <div className={`rounded-2xl border px-5 py-4 text-sm font-bold ${isDark ? 'border-blue-500/20 bg-blue-500/10 text-blue-200' : 'border-blue-100 bg-blue-50 text-blue-700'}`}>
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500">
          Loading plans...
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {orderedPlans.map((plan) => {
            const isActive = activePlanId === plan.id && subscription?.active
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                  isDark ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-950'
                } ${plan.id === 'monthly_499' ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-blue-500">{plan.badge}</p>
                    <h2 className="mt-1 text-lg font-black">{plan.name}</h2>
                  </div>
                  {isActive ? (
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase text-emerald-500">
                      Active
                    </span>
                  ) : null}
                </div>

                <div className="mt-3">
                  <span className="text-3xl font-black">Rs {plan.priceInr}</span>
                  <span className={`ml-1 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    / {plan.durationDays >= 365 ? 'year' : plan.durationDays <= 7 ? 'week' : 'month'}
                  </span>
                </div>

                <div className={`mt-3 grid grid-cols-3 gap-2 rounded-2xl p-3 text-center text-[11px] font-black ${isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
                  <p>{formatPlanLimit(plan.listLimit)}<span className="block text-[9px] text-slate-400">lists</span></p>
                  <p>{formatPlanLimit(plan.storageGb, 'GB')}<span className="block text-[9px] text-slate-400">storage</span></p>
                  <p>{plan.durationDays}<span className="block text-[9px] text-slate-400">days</span></p>
                </div>

                <div className="mt-3 flex-1 space-y-1.5">
                  {plan.benefits.slice(0, 3).map((benefit) => (
                    <p key={benefit} className={`text-xs font-semibold leading-snug ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      <span className="mr-2 text-emerald-500">+</span>
                      {benefit}
                    </p>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleBuyPlan(plan.id)}
                  disabled={Boolean(buyingPlanId)}
                  className={`mt-4 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500'
                  }`}
                >
                  {isActive ? 'Current Plan' : buyingPlanId === plan.id ? 'Opening...' : 'Buy Now'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default BillingPage
