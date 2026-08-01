import localDb from '../server/localDb.js'
import { decryptText } from '../server/cryptoUtils.js'

export default async function handler(req, res) {
  const apiKey = (
    req.headers['x-api-key'] ||
    req.query.api_key ||
    req.query.key ||
    (req.body && (req.body.api_key || req.body.key))
  )

  // 1. If no API key supplied, check system health
  if (!apiKey) {
    const conn = localDb.prepare("SELECT * FROM api_connections WHERE id = 'primary'").get()
    return res.status(200).json({
      success: true,
      status: 'healthy',
      service_identity: 'RW_PLAY_STORE_SCRAPER_V1',
      version: '1.2.0',
      message: 'RW Live Management & Scraper API is online.',
      connection_status: conn?.status || 'Disconnected',
      timestamp: new Date().toISOString()
    })
  }

  // 2. Validate API key against client_api_keys table
  const client = localDb.prepare('SELECT * FROM client_api_keys WHERE api_key = ?').get(apiKey)

  if (!client) {
    return res.status(401).json({
      success: false,
      status: 'invalid_api_key',
      message: 'Invalid API Key. The specified API Key was not found or authorized.'
    })
  }

  const now = new Date()
  const expiry = new Date(client.expiry_date)
  const isExpired = now > expiry

  if (isExpired) {
    return res.status(402).json({
      success: false,
      status: 'subscription_expired',
      message: 'Subscription expired. Please renew access.',
      client_name: client.client_name,
      expiry_date: client.expiry_date
    })
  }

  if (client.status === 'suspended' || !client.is_active) {
    return res.status(403).json({
      success: false,
      status: 'paused',
      message: 'API Key is currently suspended or paused.',
      client_name: client.client_name
    })
  }

  if (client.requests_used >= client.request_limit && client.request_limit < 999999000) {
    return res.status(429).json({
      success: false,
      status: 'limit_exceeded',
      message: 'Request limit reached for this billing cycle.',
      client_name: client.client_name,
      request_limit: client.request_limit,
      requests_used: client.requests_used
    })
  }

  return res.status(200).json({
    success: true,
    status: 'connected',
    service_identity: 'RW_PLAY_STORE_SCRAPER_V1',
    version: '1.2.0',
    client_id: client.id,
    client_name: client.client_name,
    subscription_plan: client.subscription_plan,
    expiry_date: client.expiry_date,
    request_limit: client.request_limit,
    requests_used: client.requests_used,
    requests_remaining: Math.max(0, client.request_limit - client.requests_used),
    verified_at: new Date().toISOString()
  })
}
