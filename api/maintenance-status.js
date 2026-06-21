import localDb from '../server/localDb.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const activeRow = localDb.prepare("SELECT value FROM settings WHERE key = 'maintenance_active'").get()
    const endTimeRow = localDb.prepare("SELECT value FROM settings WHERE key = 'maintenance_end_time'").get()
    const messageRow = localDb.prepare("SELECT value FROM settings WHERE key = 'maintenance_message'").get()

    const active = activeRow ? activeRow.value === 'true' : false
    const endTime = endTimeRow ? endTimeRow.value : ''
    const message = messageRow ? messageRow.value : 'We are improving your experience. Please wait until the maintenance window is complete.'

    let isCurrentlyActive = active
    if (active && endTime) {
      const endMs = Number(endTime)
      if (Date.now() >= endMs) {
        isCurrentlyActive = false
        localDb.prepare("UPDATE settings SET value = 'false' WHERE key = 'maintenance_active'").run()
      }
    }

    return res.status(200).json({
      active: isCurrentlyActive,
      endTime: endTime ? Number(endTime) : null,
      message,
      currentTime: Date.now()
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
