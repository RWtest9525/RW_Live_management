import localDb from '../server/localDb.js'
import { decryptText, maskApiKey } from '../server/cryptoUtils.js'
import { readActiveUserFromRequest } from '../server/auth.js'

export default async function handler(req, res) {
  const { method } = req

  try {
    const user = readActiveUserFromRequest(req)

    if (method === 'GET') {
      const conn = localDb.prepare('SELECT * FROM api_connections WHERE id = ?').get('primary')
      if (!conn) {
        return res.status(200).json({
          status: 'Disconnected',
          healthStatus: 'Not Configured',
          lastConnected: null,
          lastSync: null,
          nextSync: null,
          responseTimeMs: 0,
          errorCount: 0
        })
      }

      const rawApiKey = decryptText(conn.encryptedApiKey)

      return res.status(200).json({
        id: conn.id,
        baseUrl: conn.baseUrl,
        maskedApiKey: maskApiKey(rawApiKey),
        status: conn.status,
        healthStatus: conn.healthStatus,
        lastConnected: conn.lastConnected,
        lastSync: conn.lastSync,
        nextSync: conn.nextSync,
        responseTimeMs: conn.responseTimeMs,
        errorCount: conn.errorCount,
        lastError: conn.lastError,
        serviceIdentity: conn.serviceIdentity,
        apiVersion: conn.apiVersion,
        updatedAt: conn.updatedAt
      })
    }

    if (method === 'POST') {
      const { action } = req.body

      if (action === 'retry') {
        const conn = localDb.prepare('SELECT * FROM api_connections WHERE id = ?').get('primary')
        if (!conn) {
          return res.status(404).json({ error: 'No API connection configured' })
        }

        const rawApiKey = decryptText(conn.encryptedApiKey)
        if (!rawApiKey) {
          return res.status(400).json({ error: 'Stored API Key is invalid or empty' })
        }

        // Trigger real verification call
        const verifyEndpoint = `${conn.baseUrl.replace(/\/+$/, '')}/api/verify`
        const startTime = Date.now()

        try {
          const response = await fetch(verifyEndpoint, {
            method: 'GET',
            headers: { 'X-API-KEY': rawApiKey, 'Accept': 'application/json' }
          })
          const duration = Date.now() - startTime
          const payload = await response.json().catch(() => ({}))

          if (response.ok && payload.success) {
            const nowIso = new Date().toISOString()
            const nextSyncIso = new Date(Date.now() + 5 * 60 * 1000).toISOString()

            localDb.prepare(`
              UPDATE api_connections
              SET status = 'Connected', healthStatus = 'Healthy', lastConnected = ?,
                  nextSync = ?, responseTimeMs = ?, errorCount = 0, lastError = NULL, updatedAt = ?
              WHERE id = 'primary'
            `).run(nowIso, nextSyncIso, duration, nowIso)

            return res.status(200).json({
              success: true,
              status: 'Connected',
              healthStatus: 'Healthy',
              message: 'Connection re-verified and healthy!',
              responseTimeMs: duration
            })
          }

          const failureStatus = payload.status || 'Server Offline'
          const failureErr = payload.message || `HTTP ${response.status}`

          localDb.prepare(`
            UPDATE api_connections
            SET status = ?, healthStatus = 'Error', errorCount = errorCount + 1, lastError = ?, updatedAt = ?
            WHERE id = 'primary'
          `).run(failureStatus, failureErr, new Date().toISOString())

          return res.status(400).json({
            success: false,
            status: failureStatus,
            error: failureErr,
            responseTimeMs: duration
          })
        } catch (err) {
          localDb.prepare(`
            UPDATE api_connections
            SET status = 'Server Offline', healthStatus = 'Offline', errorCount = errorCount + 1, lastError = ?, updatedAt = ?
            WHERE id = 'primary'
          `).run(err.message, new Date().toISOString())

          return res.status(400).json({
            success: false,
            status: 'Server Offline',
            error: err.message
          })
        }
      }

      return res.status(400).json({ error: 'Invalid action' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[connection-status] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
