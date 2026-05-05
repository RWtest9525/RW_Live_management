import { authenticateUser, createSessionToken } from '../server/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body ?? {}
    const user = await authenticateUser({ email, password })
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or expired access.' })
    }

    const token = createSessionToken(user)
    return res.status(200).json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name ?? '',
        email: user.email,
        phone: user.phone ?? '',
        role: user.role ?? 'user',
        accessPlan: user.accessPlan ?? 'trial',
        validUntil: user.validUntil ?? null,
        driveFolderId: user.driveFolderId ?? null,
      },
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
