import crypto from 'node:crypto'
import { readActiveUserFromRequest } from '../server/auth.js'
import localDb from '../server/localDb.js'
import { getSubscriptionPlan } from '../shared/subscriptionPlans.js'

const createRazorpayOrder = async ({ amountPaise, currency, receipt, notes }) => {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys are not configured on server.')
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency,
      receipt,
      notes,
    }),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.description || 'Unable to create Razorpay order')
  }
  return payload
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = readActiveUserFromRequest(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized or account is not active' })

    const { planId } = req.body ?? {}
    const plan = getSubscriptionPlan(planId)
    if (!plan) return res.status(400).json({ error: 'Invalid plan selected' })

    const amountPaise = plan.priceInr * 100
    const receipt = `rw_${user.id}_${Date.now()}`.slice(0, 40)
    const order = await createRazorpayOrder({
      amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: user.id,
        planId: plan.id,
        email: user.email,
      },
    })

    localDb
      .prepare(
        `INSERT INTO payments (
          id, userId, planId, amountInr, currency, razorpayOrderId,
          razorpayPaymentId, status, failureReason, createdAt, paidAt, updatedAt
        ) VALUES (
          @id, @userId, @planId, @amountInr, @currency, @razorpayOrderId,
          @razorpayPaymentId, @status, @failureReason, @createdAt, @paidAt, @updatedAt
        )`,
      )
      .run({
        id: crypto.randomUUID(),
        userId: user.id,
        planId: plan.id,
        amountInr: plan.priceInr,
        currency: 'INR',
        razorpayOrderId: order.id,
        razorpayPaymentId: null,
        status: 'clicked',
        failureReason: null,
        createdAt: new Date().toISOString(),
        paidAt: null,
        updatedAt: new Date().toISOString(),
      })

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      keyId: process.env.RAZORPAY_KEY_ID,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    })
  } catch (error) {
    console.error('Create Razorpay order failed:', error)
    return res.status(500).json({ error: error.message })
  }
}
