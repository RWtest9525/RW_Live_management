import { readAuthUserFromRequest } from '../server/auth.js'
import localDb from '../server/localDb.js'
import { getUsers } from '../server/userStore.js'
import { SUBSCRIPTION_PLANS } from '../shared/subscriptionPlans.js'
import { getSubscriptionSummary } from '../server/subscription.js'

const normalizePayment = (payment, usersById) => {
  const user = usersById.get(payment.userId)
  const plan = SUBSCRIPTION_PLANS[payment.planId] ?? null
  return {
    ...payment,
    userName: user?.name ?? 'Unknown user',
    userEmail: user?.email ?? '',
    userPhone: user?.phone ?? '',
    planName: plan?.name ?? payment.planId,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authUser = await readAuthUserFromRequest(req)
    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const users = getUsers()
    const usersById = new Map(users.map((user) => [user.id, user]))
    const payments = localDb
      .prepare('SELECT * FROM payments ORDER BY datetime(createdAt) DESC, rowid DESC')
      .all()
      .map((payment) => normalizePayment(payment, usersById))

    const userSubscriptions = users
      .filter((user) => user.role !== 'admin')
      .map(({ passwordHash, ...user }) => {
        const summary = getSubscriptionSummary(user)
        const latestPayment = payments.find((payment) => payment.userId === user.id) ?? null
        return {
          ...user,
          subscription: summary,
          latestPayment,
        }
      })

    const summary = {
      totalUsers: userSubscriptions.length,
      activeUsers: userSubscriptions.filter((user) => user.subscription.active).length,
      paidPayments: payments.filter((payment) => payment.status === 'paid').length,
      pendingPayments: payments.filter((payment) => ['clicked', 'created'].includes(payment.status)).length,
      failedPayments: payments.filter((payment) => payment.status === 'failed').length,
      revenueInr: payments
        .filter((payment) => payment.status === 'paid')
        .reduce((sum, payment) => sum + Number(payment.amountInr || 0), 0),
    }

    return res.status(200).json({
      summary,
      payments,
      users: userSubscriptions,
      plans: Object.values(SUBSCRIPTION_PLANS),
    })
  } catch (error) {
    console.error('Admin subscriptions error:', error)
    return res.status(500).json({ error: error.message })
  }
}
