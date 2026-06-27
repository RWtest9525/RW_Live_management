import { authenticateUser, createSessionToken } from '../server/auth.js'
import { getSubscriptionSummary } from '../server/subscription.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body ?? {}
    console.log('Login attempt for:', email)
    const user = await authenticateUser({ email, password })
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your account registration request has been rejected by the admin.' })
    }

    if (user.status === 'deactivated') {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact support.' })
    }

    const token = createSessionToken(user)
    return res.status(200).json({
      ok: true,
      token,
      user,
      subscription: getSubscriptionSummary(user),
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: error.message })
  }
}
