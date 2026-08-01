import localDb from '../server/localDb.js'
import { encryptText, decryptText, maskApiKey } from '../server/cryptoUtils.js'
import { readActiveUserFromRequest } from '../server/auth.js'

/**
 * Validate URL string
 */
function isValidUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false
  try {
    const parsed = new URL(urlString.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Helper to log audit events
 */
function createAuditLog(userId, userEmail, action, details) {
  try {
    localDb.prepare(`
      INSERT INTO audit_logs (id, userId, userEmail, action, details, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId || 'system',
      userEmail || 'system',
      action,
      JSON.stringify(details),
      new Date().toISOString()
    )
  } catch (err) {
    console.warn('[auditLog] failed:', err.message)
  }
}

/**
 * Performs real backend HTTP verification against the Python API endpoints.
 */
async function performRealApiVerification(baseUrl, apiKey) {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, '')
  const verifyEndpoint = `${cleanUrl}/api/verify`
  const healthEndpoint = `${cleanUrl}/api/health`
  
  const startTime = Date.now()

  try {
    // 1. First test service health & connectivity
    const healthController = new AbortController()
    const healthTimeout = setTimeout(() => healthController.abort(), 8000)

    let healthRes
    try {
      healthRes = await fetch(healthEndpoint, {
        method: 'GET',
        signal: healthController.signal,
        headers: { 'Accept': 'application/json' }
      })
    } catch (fetchErr) {
      clearTimeout(healthTimeout)
      return {
        success: false,
        status: 'Server Offline',
        error: `Could not reach Python API server at ${cleanUrl}. Server offline or URL unreachable.`,
        healthStatus: 'Offline',
        responseTimeMs: Date.now() - startTime
      }
    }
    clearTimeout(healthTimeout)

    // 2. Call real verify endpoint with API Key
    const verifyController = new AbortController()
    const verifyTimeout = setTimeout(() => verifyController.abort(), 10000)

    let verifyRes
    try {
      verifyRes = await fetch(verifyEndpoint, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'Accept': 'application/json'
        },
        signal: verifyController.signal
      })
    } catch (err) {
      clearTimeout(verifyTimeout)
      return {
        success: false,
        status: 'Server Offline',
        error: `Failed connection to verification endpoint: ${err.message}`,
        healthStatus: 'Unreachable',
        responseTimeMs: Date.now() - startTime
      }
    }
    clearTimeout(verifyTimeout)

    const responseTimeMs = Date.now() - startTime
    let payload = {}
    try {
      payload = await verifyRes.json()
    } catch (e) {
      return {
        success: false,
        status: 'Invalid URL',
        error: 'Target URL returned invalid non-JSON response.',
        healthStatus: 'Invalid Response',
        responseTimeMs
      }
    }

    // 3. Evaluate verification results
    if (verifyRes.status === 401 || payload.status === 'invalid_api_key') {
      return {
        success: false,
        status: 'Invalid API Key',
        error: payload.message || 'Verification failed: The provided API Key is invalid or unauthorized.',
        healthStatus: 'Authentication Failed',
        responseTimeMs
      }
    }

    if (verifyRes.status === 402 || payload.status === 'subscription_expired') {
      return {
        success: false,
        status: 'Subscription Expired',
        error: payload.message || 'Verification failed: The API subscription attached to this key has expired.',
        healthStatus: 'Subscription Expired',
        responseTimeMs
      }
    }

    if (verifyRes.status === 403 || payload.status === 'paused') {
      return {
        success: false,
        status: 'Disconnected',
        error: payload.message || 'Verification failed: API Key is currently paused or inactive.',
        healthStatus: 'Key Paused',
        responseTimeMs
      }
    }

    if (verifyRes.status === 429 || payload.status === 'limit_exceeded') {
      return {
        success: false,
        status: 'Limit Exceeded',
        error: payload.message || 'Verification failed: Request limits have been exceeded for this key.',
        healthStatus: 'Limit Exhausted',
        responseTimeMs
      }
    }

    if (!verifyRes.ok || !payload.success) {
      return {
        success: false,
        status: payload.status || 'Verification Failed',
        error: payload.message || `Verification endpoint returned HTTP ${verifyRes.status}`,
        healthStatus: 'Verification Failed',
        responseTimeMs
      }
    }

    // Success! Verification passed all checks
    return {
      success: true,
      status: 'Connected',
      healthStatus: 'Healthy',
      serviceIdentity: payload.service_identity || 'RW_PLAY_STORE_SCRAPER_V1',
      apiVersion: payload.version || '1.2.0',
      clientName: payload.client_name,
      subscriptionPlan: payload.subscription_plan,
      expiryDate: payload.expiry_date,
      requestsRemaining: payload.requests_remaining,
      requestLimit: payload.request_limit,
      requestsUsed: payload.requests_used,
      responseTimeMs
    }
  } catch (err) {
    return {
      success: false,
      status: 'Server Offline',
      error: `Connection error: ${err.message}`,
      healthStatus: 'Error',
      responseTimeMs: Date.now() - startTime
    }
  }
}

export default async function handler(req, res) {
  const { method } = req

  try {
    const user = readActiveUserFromRequest(req)
    
    // ---------------------------------------------------------
    // GET: Retrieve Current Stored Connection Configuration & Status
    // ---------------------------------------------------------
    if (method === 'GET') {
      const stored = localDb.prepare('SELECT * FROM api_connections WHERE id = ?').get('primary')
      
      if (!stored) {
        return res.status(200).json({
          success: true,
          connection: {
            baseUrl: '',
            maskedApiKey: '',
            status: 'Disconnected',
            healthStatus: 'Not Configured',
            lastConnected: null,
            lastSync: null,
            nextSync: null,
            responseTimeMs: 0,
            errorCount: 0
          }
        })
      }

      const rawApiKey = decryptText(stored.encryptedApiKey)

      return res.status(200).json({
        success: true,
        connection: {
          id: stored.id,
          baseUrl: stored.baseUrl,
          maskedApiKey: maskApiKey(rawApiKey),
          status: stored.status,
          healthStatus: stored.healthStatus,
          lastConnected: stored.lastConnected,
          lastSync: stored.lastSync,
          nextSync: stored.nextSync,
          responseTimeMs: stored.responseTimeMs,
          errorCount: stored.errorCount,
          lastError: stored.lastError,
          serviceIdentity: stored.serviceIdentity,
          apiVersion: stored.apiVersion,
          updatedAt: stored.updatedAt
        }
      })
    }

    // ---------------------------------------------------------
    // POST: Connect / Verify / Disconnect Actions
    // ---------------------------------------------------------
    if (method === 'POST') {
      const { action = 'verify', baseUrl, apiKey } = req.body

      // Action 1: Disconnect
      if (action === 'disconnect') {
        localDb.prepare(`
          UPDATE api_connections
          SET status = 'Disconnected', healthStatus = 'Disconnected', updatedAt = ?
          WHERE id = 'primary'
        `).run(new Date().toISOString())

        if (user) {
          createAuditLog(user.id, user.email, 'API_DISCONNECT', { message: 'Disconnected API integration' })
        }

        return res.status(200).json({
          success: true,
          status: 'Disconnected',
          message: 'API connection disconnected successfully.'
        })
      }

      // Action 2: Verify & Connect Credentials
      if (!baseUrl || !apiKey) {
        return res.status(400).json({
          success: false,
          status: 'Invalid Input',
          error: 'API Base URL and API Key are required for verification.'
        })
      }

      // Validate URL Syntax
      if (!isValidUrl(baseUrl)) {
        return res.status(400).json({
          success: false,
          status: 'Invalid URL',
          error: 'Invalid API Base URL format. Must start with http:// or https://'
        })
      }

      // Execute REAL Backend Verification!
      const verifyResult = await performRealApiVerification(baseUrl, apiKey)

      // IF VERIFICATION FAILS -> DO NOT SAVE CREDENTIALS! SHOW PROPER ERROR.
      if (!verifyResult.success) {
        if (user) {
          createAuditLog(user.id, user.email, 'API_VERIFY_FAILED', {
            baseUrl,
            status: verifyResult.status,
            error: verifyResult.error
          })
        }

        // Increment error count on existing record if present
        localDb.prepare(`
          UPDATE api_connections
          SET errorCount = errorCount + 1, lastError = ?, status = ?, healthStatus = ?, updatedAt = ?
          WHERE id = 'primary'
        `).run(verifyResult.error, verifyResult.status, verifyResult.healthStatus, new Date().toISOString())

        return res.status(400).json({
          success: false,
          status: verifyResult.status,
          error: verifyResult.error,
          healthStatus: verifyResult.healthStatus,
          responseTimeMs: verifyResult.responseTimeMs
        })
      }

      // VERIFICATION SUCCEEDED -> Encrypt API Key and SAVE connection!
      const encryptedKey = encryptText(apiKey.trim())
      const nowIso = new Date().toISOString()
      const nextSyncIso = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      localDb.prepare(`
        INSERT INTO api_connections (
          id, baseUrl, encryptedApiKey, status, lastConnected, lastSync, nextSync,
          healthStatus, responseTimeMs, errorCount, lastError, serviceIdentity, apiVersion, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          baseUrl = excluded.baseUrl,
          encryptedApiKey = excluded.encryptedApiKey,
          status = excluded.status,
          lastConnected = excluded.lastConnected,
          nextSync = excluded.nextSync,
          healthStatus = excluded.healthStatus,
          responseTimeMs = excluded.responseTimeMs,
          errorCount = 0,
          lastError = NULL,
          serviceIdentity = excluded.serviceIdentity,
          apiVersion = excluded.apiVersion,
          updatedAt = excluded.updatedAt
      `).run(
        'primary',
        baseUrl.trim().replace(/\/+$/, ''),
        encryptedKey,
        'Connected',
        nowIso,
        nowIso,
        nextSyncIso,
        'Healthy',
        verifyResult.responseTimeMs,
        0,
        null,
        verifyResult.serviceIdentity,
        verifyResult.apiVersion,
        nowIso
      )

      if (user) {
        createAuditLog(user.id, user.email, 'API_VERIFY_SUCCESS', {
          baseUrl,
          clientName: verifyResult.clientName,
          plan: verifyResult.subscriptionPlan
        })
      }

      return res.status(200).json({
        success: true,
        status: 'Connected',
        message: 'API Credentials verified and connection saved successfully!',
        connection: {
          baseUrl: baseUrl.trim().replace(/\/+$/, ''),
          maskedApiKey: maskApiKey(apiKey.trim()),
          status: 'Connected',
          healthStatus: 'Healthy',
          lastConnected: nowIso,
          lastSync: nowIso,
          nextSync: nextSyncIso,
          responseTimeMs: verifyResult.responseTimeMs,
          clientName: verifyResult.clientName,
          subscriptionPlan: verifyResult.subscriptionPlan,
          requestsRemaining: verifyResult.requestsRemaining
        }
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[verify-connections] Error:', err)
    return res.status(500).json({
      success: false,
      status: 'Server Error',
      error: err.message || 'Internal server error during connection verification.'
    })
  }
}
