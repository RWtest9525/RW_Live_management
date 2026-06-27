import { readActiveUserFromRequest } from '../server/auth.js'
import localDb from '../server/localDb.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = readActiveUserFromRequest(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized or account is not active' })

    const { orderId, paymentId = null, reason = 'Payment failed or cancelled' } = req.body ?? {}
    if (!orderId) return res.status(400).json({ error: 'orderId is required' })

    const payment = localDb
      .prepare('SELECT * FROM payments WHERE razorpayOrderId = ? AND userId = ?')
      .get(orderId, user.id)

    if (!payment) return res.status(404).json({ error: 'Payment order not found' })
    if (payment.status === 'paid') return res.status(200).json({ ok: true, status: 'paid' })

    localDb
      .prepare(
        'UPDATE payments SET razorpayPaymentId = COALESCE(?, razorpayPaymentId), status = ?, failureReason = ?, updatedAt = ? WHERE razorpayOrderId = ?',
      )
      .run(paymentId, 'failed', String(reason).slice(0, 500), new Date().toISOString(), orderId)

    return res.status(200).json({ ok: true, status: 'failed' })
  } catch (error) {
    console.error('Mark billing failed error:', error)
    return res.status(500).json({ error: error.message })
  }
}
