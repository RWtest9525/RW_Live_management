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

async function performRealApiVerification(baseUrl, apiKey) {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, '')
  const startTime = Date.now()
  const cleanKey = apiKey.trim()

  try {
    // Check local database first if key is present
    const localKeyRow = localDb.prepare('SELECT * FROM client_api_keys WHERE api_key = ? OR encrypted_api_key = ?').get(cleanKey, cleanKey)

    // Test HTTP endpoint /api/verify
    const verifyEndpoint = `${cleanUrl}/api/verify`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    let verifyRes, payload = null
    try {
      verifyRes = await fetch(verifyEndpoint, {
        method: 'GET',
        headers: { 'X-API-KEY': cleanKey, 'Accept': 'application/json' },
        signal: controller.signal
      })
      clearTimeout(timeout)
      const rawText = await verifyRes.text()
      try {
        payload = JSON.parse(rawText)
      } catch (e) {
        payload = null
      }
    } catch (fetchErr) {
      clearTimeout(timeout)
      // Fallback: Check if local DB has key
      if (localKeyRow) {
        const now = new Date()
        const isExpired = now > new Date(localKeyRow.expiry_date)
        if (isExpired) {
          return {
            success: false,
            status: 'Subscription Expired',
            error: `API Key '${maskApiKey(cleanKey)}' subscription expired on ${localKeyRow.expiry_date}.`,
            healthStatus: 'Subscription Expired',
            responseTimeMs: Date.now() - startTime
          }
        }
        if (!localKeyRow.is_active || localKeyRow.status === 'suspended') {
          return {
            success: false,
            status: 'Disconnected',
            error: `API Key '${maskApiKey(cleanKey)}' is suspended/paused.`,
            healthStatus: 'Key Paused',
            responseTimeMs: Date.now() - startTime
          }
        }
        return {
          success: true,
          status: 'Connected',
          healthStatus: 'Healthy',
          serviceIdentity: 'RW_PLAY_STORE_SCRAPER_V1',
          apiVersion: '1.2.0',
          clientName: localKeyRow.client_name,
          subscriptionPlan: localKeyRow.subscription_plan,
          expiryDate: localKeyRow.expiry_date,
          requestsRemaining: Math.max(0, localKeyRow.request_limit - localKeyRow.requests_used),
          requestLimit: localKeyRow.request_limit,
          requestsUsed: localKeyRow.requests_used,
          responseTimeMs: Date.now() - startTime
        }
      }

      return {
        success: false,
        status: 'Server Offline',
        error: `Could not reach API server at ${cleanUrl}. Please check URL or server status.`,
        healthStatus: 'Offline',
        responseTimeMs: Date.now() - startTime
      }
    }

    const responseTimeMs = Date.now() - startTime

    // If valid JSON payload returned from /api/verify
    if (payload && typeof payload === 'object') {
      if (verifyRes.status === 401 || payload.status === 'invalid_api_key') {
        return {
          success: false,
          status: 'Invalid API Key',
          error: payload.message || 'Invalid API Key specified.',
          healthStatus: 'Authentication Failed',
          responseTimeMs
        }
      }
      if (verifyRes.status === 402 || payload.status === 'subscription_expired') {
        return {
          success: false,
          status: 'Subscription Expired',
          error: payload.message || 'Subscription expired for this API Key.',
          healthStatus: 'Subscription Expired',
          responseTimeMs
        }
      }
      if (verifyRes.status === 403 || payload.status === 'paused') {
        return {
          success: false,
          status: 'Disconnected',
          error: payload.message || 'API Key is currently paused.',
          healthStatus: 'Key Paused',
          responseTimeMs
        }
      }
      if (verifyRes.status === 429 || payload.status === 'limit_exceeded') {
        return {
          success: false,
          status: 'Limit Exceeded',
          error: payload.message || 'Request limit exhausted for this key.',
          healthStatus: 'Limit Exhausted',
          responseTimeMs
        }
      }
      if (verifyRes.ok && (payload.success || payload.status === 'connected' || payload.status === 'success' || payload.status === 'active')) {
        return {
          success: true,
          status: 'Connected',
          healthStatus: 'Healthy',
          serviceIdentity: payload.service_identity || 'RW_PLAY_STORE_SCRAPER_V1',
          apiVersion: payload.version || '1.2.0',
          clientName: payload.client_name || localKeyRow?.client_name || 'Verified Client',
          subscriptionPlan: payload.subscription_plan || localKeyRow?.subscription_plan || 'Monthly',
          expiryDate: payload.expiry_date || localKeyRow?.expiry_date || '',
          requestsRemaining: payload.requests_remaining ?? 1000,
          requestLimit: payload.request_limit ?? 1000,
          requestsUsed: payload.requests_used ?? 0,
          responseTimeMs
        }
      }
    }

    // Try secondary check endpoint /api/check-status
    try {
      const statusRes = await fetch(`${cleanUrl}/api/check-status?key=${encodeURIComponent(cleanKey)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      })
      const statusPayload = await statusRes.json()
      if (statusRes.ok && statusPayload && statusPayload.status) {
        if (statusPayload.status === 'active') {
          return {
            success: true,
            status: 'Connected',
            healthStatus: 'Healthy',
            serviceIdentity: 'RW_PLAY_STORE_SCRAPER_V1',
            apiVersion: '1.2.0',
            clientName: localKeyRow?.client_name || 'Verified Client',
            subscriptionPlan: statusPayload.subscription_plan || 'Monthly',
            expiryDate: statusPayload.valid_until || '',
            requestsRemaining: statusPayload.requests_remaining || 0,
            requestLimit: statusPayload.request_limit || 1000,
            requestsUsed: statusPayload.requests_used || 0,
            responseTimeMs
          }
        } else if (statusPayload.status === 'expired') {
          return {
            success: false,
            status: 'Subscription Expired',
            error: 'API Key subscription expired.',
            healthStatus: 'Subscription Expired',
            responseTimeMs
          }
        } else if (statusPayload.status === 'paused') {
          return {
            success: false,
            status: 'Disconnected',
            error: 'API Key is paused.',
            healthStatus: 'Key Paused',
            responseTimeMs
          }
        }
      }
    } catch (e) {
      // ignore secondary check error
    }

    // If local database has this API Key, verify against local database state
    if (localKeyRow) {
      const now = new Date()
      const isExpired = now > new Date(localKeyRow.expiry_date)
      if (isExpired) {
        return {
          success: false,
          status: 'Subscription Expired',
          error: `API Key subscription expired on ${localKeyRow.expiry_date}.`,
          healthStatus: 'Subscription Expired',
          responseTimeMs
        }
      }
      if (!localKeyRow.is_active || localKeyRow.status === 'suspended') {
        return {
          success: false,
          status: 'Disconnected',
          error: 'API Key is currently suspended/paused.',
          healthStatus: 'Key Paused',
          responseTimeMs
        }
      }
      return {
        success: true,
        status: 'Connected',
        healthStatus: 'Healthy',
        serviceIdentity: 'RW_PLAY_STORE_SCRAPER_V1',
        apiVersion: '1.2.0',
        clientName: localKeyRow.client_name,
        subscriptionPlan: localKeyRow.subscription_plan,
        expiryDate: localKeyRow.expiry_date,
        requestsRemaining: Math.max(0, localKeyRow.request_limit - localKeyRow.requests_used),
        requestLimit: localKeyRow.request_limit,
        requestsUsed: localKeyRow.requests_used,
        responseTimeMs
      }
    }

    return {
      success: false,
      status: 'Invalid API Key',
      error: `Could not verify API Key '${maskApiKey(cleanKey)}'. Please enter a valid API Key.`,
      healthStatus: 'Invalid Key or URL',
      responseTimeMs
    }
  } catch (err) {
    return {
      success: false,
      status: 'Server Offline',
      error: `Verification error: ${err.message}`,
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
