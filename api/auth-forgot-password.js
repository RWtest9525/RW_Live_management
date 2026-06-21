import { getUsers } from '../server/userStore.js'
import { createPasswordRequestLocal } from '../server/dataService.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { identifier, passwordType, step } = req.body

    if (!identifier) {
      return res.status(400).json({ error: 'Email or Phone is required' })
    }

    const users = getUsers()
    const user = users.find(u => 
      (u.email && u.email.toLowerCase() === identifier.toLowerCase()) || 
      (u.phone && u.phone === identifier)
    )

    if (!user) {
      return res.status(404).json({ error: 'User not found with this Email or Phone' })
    }

    if (step === 1) {
      // Step 1: User found, now UI should ask for password type
      return res.status(200).json({
        ok: true,
        step: 2,
        message: 'User found. Please select password type.',
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone
        }
      })
    }

    if (step === 2) {
      // Step 2: Password type received, create request
      createPasswordRequestLocal({
        userId: user.id,
        email: user.email,
        phone: user.phone,
        passwordType: passwordType || 'standard'
      })

      return res.status(200).json({
        ok: true,
        message: 'Your password reset request was sent to admin. After approval, admin will share your temporary password on WhatsApp or email.',
      })
    }

    return res.status(400).json({ error: 'Invalid step' })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
