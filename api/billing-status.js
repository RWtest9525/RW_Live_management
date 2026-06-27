import { readActiveUserFromRequest } from '../server/auth.js'
import { SUBSCRIPTION_PLANS } from '../shared/subscriptionPlans.js'
import { getSubscriptionSummary } from '../server/subscription.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = readActiveUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized or account is not active' })

  return res.status(200).json({
    plans: Object.values(SUBSCRIPTION_PLANS),
    subscription: getSubscriptionSummary(user),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
  })
}
