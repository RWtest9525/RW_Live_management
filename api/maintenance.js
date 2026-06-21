import { readAuthUserFromRequest } from '../server/auth.js'
import localDb from '../server/localDb.js'

export default async function handler(req, res) {
  try {
    const authUser = await readAuthUserFromRequest(req)
    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { method } = req

    if (method === 'GET') {
      const activeRow = localDb.prepare("SELECT value FROM settings WHERE key = 'maintenance_active'").get()
      const endTimeRow = localDb.prepare("SELECT value FROM settings WHERE key = 'maintenance_end_time'").get()
      const messageRow = localDb.prepare("SELECT value FROM settings WHERE key = 'maintenance_message'").get()

      const active = activeRow ? activeRow.value === 'true' : false
      const endTime = endTimeRow ? endTimeRow.value : ''
      const message = messageRow ? messageRow.value : ''

      return res.status(200).json({
        active,
        endTime: endTime ? Number(endTime) : null,
        message,
        currentTime: Date.now()
      })
    }

    if (method === 'POST') {
      const { active, duration, message } = req.body ?? {}
      
      if (message !== undefined) {
        localDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_message', ?)").run(message)
      }

      if (active === true) {
        localDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_active', 'true')").run()
        if (duration) {
          const parts = duration.split(':')
          const hours = Number(parts[0]) || 0
          const minutes = Number(parts[1]) || 0
          const seconds = Number(parts[2]) || 0
          const durationMs = ((hours * 60 + minutes) * 60 + seconds) * 1000
          const endTime = Date.now() + durationMs
          localDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_end_time', ?)").run(String(endTime))
        }
      } else if (active === false) {
        localDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_active', 'false')").run()
        localDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_end_time', '')").run()
      }

      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
