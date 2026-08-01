import crypto from 'node:crypto'
import localDb from '../server/localDb.js'
import { encryptText, decryptText, maskApiKey } from '../server/cryptoUtils.js'
import { readActiveUserFromRequest } from '../server/auth.js'

function logAudit(userId, userEmail, action, details) {
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

export default async function handler(req, res) {
  const { method } = req

  try {
    const user = readActiveUserFromRequest(req)

    // ---------------------------------------------------------
    // GET: Retrieve All Client API Keys
    // ---------------------------------------------------------
    if (method === 'GET') {
      const rows = localDb.prepare(`
        SELECT id, client_name, api_key, encrypted_api_key, subscription_plan,
               start_date, expiry_date, request_limit, requests_used, status, is_active,
               last_login, created_at, updated_at
        FROM client_api_keys
        ORDER BY id DESC
      `).all()

      const now = new Date()

      const formattedKeys = rows.map((item) => {
        const expiry = new Date(item.expiry_date)
        const isExpired = now > expiry
        const rawKey = item.api_key || (item.encrypted_api_key ? decryptText(item.encrypted_api_key) : '')

        let computedStatus = 'Active'
        if (isExpired) computedStatus = 'Expired'
        else if (item.status === 'suspended' || !item.is_active) computedStatus = 'Suspended'
        else if (item.requests_used >= item.request_limit) computedStatus = 'Exhausted'

        return {
          id: item.id,
          client_name: item.client_name,
          api_key: rawKey,
          masked_api_key: maskApiKey(rawKey),
          subscription_plan: item.subscription_plan,
          start_date: item.start_date,
          expiry_date: item.expiry_date,
          request_limit: item.request_limit,
          requests_used: item.requests_used,
          requests_remaining: Math.max(0, item.request_limit - item.requests_used),
          is_active: Boolean(item.is_active) && !isExpired,
          is_expired: isExpired,
          status: computedStatus,
          last_login: item.last_login || null,
          created_at: item.created_at
        }
      })

      // Get primary API Connection config if available
      const conn = localDb.prepare('SELECT baseUrl FROM api_connections WHERE id = ?').get('primary')
      const hfSpaceUrl = conn?.baseUrl || process.env.HF_SPACE_URL || 'https://yash9525-rw-live-checker.hf.space'

      return res.status(200).json({
        success: true,
        keys: formattedKeys,
        hf_space_url: hfSpaceUrl
      })
    }

    // ---------------------------------------------------------
    // POST: Create / Renew / Pause / Delete Key Actions
    // ---------------------------------------------------------
    if (method === 'POST') {
      const { action, client_name, subscription_plan, request_limit, expiry_date, client_id } = req.body
      const nowIso = new Date().toISOString()

      // ACTION 1: CREATE API KEY
      if (action === 'create') {
        if (!client_name) {
          return res.status(400).json({ error: 'client_name is required' })
        }

        const selectedPlan = subscription_plan || 'Monthly'
        let defaultLimit = 1000
        let defaultDays = 30

        if (selectedPlan === 'Weekly') {
          defaultLimit = 200
          defaultDays = 7
        } else if (selectedPlan === 'Enterprise') {
          defaultLimit = 999999999
          defaultDays = 365
        }

        const limitNum = request_limit !== undefined && request_limit !== null ? Number(request_limit) : defaultLimit
        const startDateIso = new Date().toISOString()

        let expiryDateIso
        if (expiry_date) {
          expiryDateIso = new Date(expiry_date).toISOString()
        } else {
          const exp = new Date()
          exp.setDate(exp.getDate() + defaultDays)
          expiryDateIso = exp.toISOString()
        }

        const rawApiKey = `sk_live_${crypto.randomBytes(16).toString('hex')}`
        const encryptedKey = encryptText(rawApiKey)

        const result = localDb.prepare(`
          INSERT INTO client_api_keys (
            client_name, api_key, encrypted_api_key, subscription_plan,
            start_date, expiry_date, request_limit, requests_used,
            status, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          client_name.trim(),
          rawApiKey,
          encryptedKey,
          selectedPlan,
          startDateIso,
          expiryDateIso,
          limitNum,
          0,
          'active',
          1,
          nowIso,
          nowIso
        )

        const newKeyObj = {
          id: result.lastInsertRowid,
          client_name: client_name.trim(),
          api_key: rawApiKey,
          masked_api_key: maskApiKey(rawApiKey),
          subscription_plan: selectedPlan,
          start_date: startDateIso,
          expiry_date: expiryDateIso,
          request_limit: limitNum,
          requests_used: 0,
          requests_remaining: limitNum,
          is_active: true,
          is_expired: false,
          status: 'Active'
        }

        if (user) {
          logAudit(user.id, user.email, 'CLIENT_KEY_CREATED', {
            client_name: client_name.trim(),
            key_id: result.lastInsertRowid,
            limit: limitNum,
            plan: selectedPlan
          })
        }

        return res.status(201).json({
          success: true,
          message: 'API Key created successfully',
          key: newKeyObj
        })
      }

      // ACTION 2: RENEW SUBSCRIPTION
      if (action === 'renew') {
        const client = localDb.prepare('SELECT * FROM client_api_keys WHERE id = ?').get(client_id)
        if (!client) return res.status(404).json({ error: 'Client key not found' })

        let extendDays = 30
        if (client.subscription_plan === 'Weekly') extendDays = 7
        else if (client.subscription_plan === 'Enterprise') extendDays = 365

        const currentExpiry = new Date(client.expiry_date)
        const now = new Date()
        const baseDate = currentExpiry > now ? currentExpiry : now
        baseDate.setDate(baseDate.getDate() + extendDays)
        const newExpiryIso = baseDate.toISOString()

        localDb.prepare(`
          UPDATE client_api_keys
          SET expiry_date = ?, requests_used = 0, status = 'active', is_active = 1, updated_at = ?
          WHERE id = ?
        `).run(newExpiryIso, nowIso, client_id)

        if (user) {
          logAudit(user.id, user.email, 'CLIENT_KEY_RENEWED', {
            client_name: client.client_name,
            key_id: client_id,
            new_expiry: newExpiryIso,
            plan: client.subscription_plan
          })
        }

        return res.status(200).json({
          success: true,
          message: `Subscription renewed for "${client.client_name}" (+${extendDays} days)`,
          expiry_date: newExpiryIso
        })
      }

      // ACTION 3: TOGGLE PAUSE / RESUME
      if (action === 'toggle-pause') {
        const client = localDb.prepare('SELECT * FROM client_api_keys WHERE id = ?').get(client_id)
        if (!client) return res.status(404).json({ error: 'Client key not found' })

        const nextActive = client.is_active === 1 ? 0 : 1
        const nextStatus = nextActive === 1 ? 'active' : 'suspended'

        localDb.prepare(`
          UPDATE client_api_keys
          SET is_active = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(nextActive, nextStatus, nowIso, client_id)

        if (user) {
          logAudit(user.id, user.email, 'CLIENT_KEY_TOGGLED', {
            client_name: client.client_name,
            key_id: client_id,
            new_status: nextStatus
          })
        }

        return res.status(200).json({
          success: true,
          message: `Key for "${client.client_name}" ${nextActive === 1 ? 'resumed' : 'paused'}`,
          is_active: Boolean(nextActive),
          status: nextActive === 1 ? 'Active' : 'Suspended'
        })
      }

      // ACTION 4: DELETE KEY
      if (action === 'delete') {
        const client = localDb.prepare('SELECT * FROM client_api_keys WHERE id = ?').get(client_id)
        if (!client) return res.status(404).json({ error: 'Client key not found' })

        localDb.prepare('DELETE FROM client_api_keys WHERE id = ?').run(client_id)

        if (user) {
          logAudit(user.id, user.email, 'CLIENT_KEY_DELETED', {
            client_name: client.client_name,
            key_id: client_id
          })
        }

        return res.status(200).json({
          success: true,
          message: `API Key for "${client.client_name}" deleted successfully`
        })
      }

      return res.status(400).json({ error: 'Invalid action specified' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[admin-client-keys] Error:', err)
    return res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
}
