import localDb from '../server/localDb.js'
import { readActiveUserFromRequest } from '../server/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = readActiveUserFromRequest(req)
    if (!user || (user.role !== 'admin' && user.email !== 'reviewsworld01@gmail.com')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' })
    }

    const { type = 'all', limit = 50 } = req.query
    const limitNum = Math.min(Math.max(1, Number(limit) || 50), 200)

    let syncLogs = []
    let failedLogs = []
    let auditLogs = []

    if (type === 'sync' || type === 'all') {
      syncLogs = localDb.prepare(`
        SELECT s.*, a.name as appName
        FROM sync_history s
        LEFT JOIN apps a ON a.id = s.appId
        ORDER BY s.createdAt DESC
        LIMIT ?
      `).all(limitNum)
    }

    if (type === 'failed' || type === 'errors' || type === 'all') {
      failedLogs = localDb.prepare(`
        SELECT f.*, a.name as appName
        FROM failed_requests f
        LEFT JOIN apps a ON a.id = f.appId
        ORDER BY f.createdAt DESC
        LIMIT ?
      `).all(limitNum)
    }

    if (type === 'audit' || type === 'all') {
      auditLogs = localDb.prepare(`
        SELECT * FROM audit_logs
        ORDER BY createdAt DESC
        LIMIT ?
      `).all(limitNum)
    }

    return res.status(200).json({
      success: true,
      syncLogs,
      failedLogs,
      auditLogs,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('[system-logs] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
