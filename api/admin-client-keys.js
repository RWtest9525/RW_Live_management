import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.resolve(__dirname, '../data')
const keysFilePath = path.join(DATA_DIR, 'client-keys.json')

const ensureFileExists = () => {
  const dir = path.dirname(keysFilePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(keysFilePath)) {
    // Initial sample seed data for Super Admin
    const seedData = [
      {
        id: 1,
        client_name: "Demo Client Corp",
        api_key: `sk_live_${crypto.randomBytes(16).toString('hex')}`,
        subscription_plan: "Monthly",
        start_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        request_limit: 5000,
        requests_used: 1420,
        is_active: true
      }
    ]
    fs.writeFileSync(keysFilePath, JSON.stringify(seedData, null, 2))
  }
}

const getKeys = () => {
  ensureFileExists()
  try {
    const raw = fs.readFileSync(keysFilePath, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    console.error('Error reading client-keys.json:', err)
    return []
  }
}

const saveKeys = (keys) => {
  const tempPath = `${keysFilePath}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(keys, null, 2))
  fs.renameSync(tempPath, keysFilePath)
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const keys = getKeys()
      const now = new Date()
      
      const keysFormatted = keys.map(item => {
        const expiry = new Date(item.expiry_date)
        const is_expired = now > expiry
        return {
          ...item,
          is_expired,
          requests_remaining: Math.max(0, item.request_limit - item.requests_used)
        }
      })

      return res.status(200).json({
        success: true,
        keys: keysFormatted,
        hf_space_url: process.env.HF_SPACE_URL || 'https://yash9525-rw-live-checker.hf.space'
      })
    }

    if (req.method === 'POST') {
      const { action, client_name, subscription_plan, request_limit, expiry_date, client_id } = req.body
      let keys = getKeys()

      if (action === 'create') {
        if (!client_name || !expiry_date) {
          return res.status(400).json({ error: 'client_name and expiry_date are required' })
        }

        const newKey = {
          id: Date.now(),
          client_name,
          api_key: `sk_live_${crypto.randomBytes(16).toString('hex')}`,
          subscription_plan: subscription_plan || 'Monthly',
          start_date: new Date().toISOString(),
          expiry_date: new Date(expiry_date).toISOString(),
          request_limit: Number(request_limit) || 5000,
          requests_used: 0,
          is_active: true
        }

        keys.unshift(newKey)
        saveKeys(keys)
        return res.status(201).json({ success: true, message: 'API Key created successfully', key: newKey })
      }

      if (action === 'renew') {
        const index = keys.findIndex(k => k.id === Number(client_id))
        if (index === -1) return res.status(404).json({ error: 'Client key not found' })

        const currentExpiry = new Date(keys[index].expiry_date)
        const now = new Date()
        const baseDate = currentExpiry > now ? currentExpiry : now
        
        // Extend by 30 days
        baseDate.setDate(baseDate.getDate() + 30)

        keys[index].expiry_date = baseDate.toISOString()
        keys[index].requests_used = 0
        keys[index].is_active = true

        saveKeys(keys)
        return res.status(200).json({ success: true, message: 'Subscription renewed for +30 days', key: keys[index] })
      }

      if (action === 'toggle-pause') {
        const index = keys.findIndex(k => k.id === Number(client_id))
        if (index === -1) return res.status(404).json({ error: 'Client key not found' })

        keys[index].is_active = !keys[index].is_active
        saveKeys(keys)
        return res.status(200).json({ success: true, message: `Key ${keys[index].is_active ? 'resumed' : 'paused'}`, key: keys[index] })
      }

      if (action === 'delete') {
        keys = keys.filter(k => k.id !== Number(client_id))
        saveKeys(keys)
        return res.status(200).json({ success: true, message: 'API Key deleted successfully' })
      }

      return res.status(400).json({ error: 'Invalid action specified' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('API Error in admin-client-keys handler:', err)
    return res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
}
