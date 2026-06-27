import localDb from '../server/localDb.js'
import { readActiveUserFromRequest } from '../server/auth.js'

const IST_OFFSET_MINUTES = 330
const DAY_MS = 24 * 60 * 60 * 1000

const getIstListingDayUtcWindow = (targetDate) => {
  const targetMs = new Date(targetDate).getTime()
  if (Number.isNaN(targetMs)) return null

  const targetIstMs = targetMs + IST_OFFSET_MINUTES * 60 * 1000
  const istDayStart = Math.floor(targetIstMs / DAY_MS) * DAY_MS
  const startMs = istDayStart - IST_OFFSET_MINUTES * 60 * 1000
  return { startMs, endMs: startMs + DAY_MS }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { appId } = req.query
  if (!appId) {
    return res.status(400).json({ error: 'appId is required' })
  }

  try {
    const user = readActiveUserFromRequest(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized or account is not active' })
    }

    const app = localDb.prepare('SELECT * FROM apps WHERE id = ?').get(appId)
    if (!app) {
      return res.status(404).json({ error: 'App not found' })
    }

    if (user.role !== 'admin' && app.ownerUserId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const rows = localDb
      .prepare('SELECT * FROM reviews WHERE appId = ? AND status = ? ORDER BY datetime(date) DESC, rowid DESC')
      .all(appId, 'VERIFIED LIVE')

    const listingWindow = app.targetDate ? getIstListingDayUtcWindow(app.targetDate) : null
    const reviews = listingWindow
      ? rows.filter((review) => {
          const reviewMs = new Date(review.date).getTime()
          return (
            !Number.isNaN(reviewMs) &&
            reviewMs >= listingWindow.startMs &&
            reviewMs < listingWindow.endMs
          )
        })
      : rows

    return res.status(200).json({ app, reviews })
  } catch (error) {
    console.error('Error fetching record data:', error)
    return res.status(500).json({ error: 'Failed to fetch record data' })
  }
}
