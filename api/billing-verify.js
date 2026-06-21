import crypto from 'node:crypto'
import { readAuthUserFromRequest } from '../server/auth.js'
import localDb from '../server/localDb.js'
import { getSubscriptionPlan } from '../shared/subscriptionPlans.js'
import { getNextValidUntil, getSubscriptionSummary } from '../server/subscription.js'
import { findUserById, updateUserById } from '../server/userStore.js'

const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) throw new Error('Razorpay secret is not configured on server.')

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  return expected === signature
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authUser = await readAuthUserFromRequest(req)
    if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } =
      req.body ?? {}

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing Razorpay payment details' })
    }

    const payment = localDb
      .prepare('SELECT * FROM payments WHERE razorpayOrderId = ? AND userId = ?')
      .get(orderId, authUser.id)

    if (!payment) {
      return res.status(404).json({ error: 'Payment order not found' })
    }

    if (payment.status === 'paid') {
      const user = findUserById(authUser.id)
      return res.status(200).json({ ok: true, subscription: getSubscriptionSummary(user) })
    }

    const isValid = verifyRazorpaySignature({ orderId, paymentId, signature })
    if (!isValid) {
      localDb
        .prepare('UPDATE payments SET status = ?, failureReason = ?, updatedAt = ? WHERE razorpayOrderId = ?')
        .run('failed', 'Payment signature verification failed', new Date().toISOString(), orderId)
      return res.status(400).json({ error: 'Payment verification failed' })
    }

    const plan = getSubscriptionPlan(payment.planId)
    if (!plan) return res.status(400).json({ error: 'Plan no longer exists' })

    const user = findUserById(authUser.id)
    const updatedUser = updateUserById(authUser.id, {
      accessPlan: plan.id,
      validUntil: getNextValidUntil(user, plan),
      lastPaymentAt: new Date().toISOString(),
      lastRazorpayPaymentId: paymentId,
    })

    localDb
      .prepare('UPDATE payments SET razorpayPaymentId = ?, status = ?, failureReason = NULL, paidAt = ?, updatedAt = ? WHERE razorpayOrderId = ?')
      .run(paymentId, 'paid', new Date().toISOString(), new Date().toISOString(), orderId)

    const { passwordHash, ...safeUser } = updatedUser
    return res.status(200).json({
      ok: true,
      user: safeUser,
      subscription: getSubscriptionSummary(safeUser),
    })
  } catch (error) {
    console.error('Verify Razorpay payment failed:', error)
    return res.status(500).json({ error: error.message })
  }
}
