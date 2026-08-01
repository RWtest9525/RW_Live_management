import crypto from 'node:crypto'

const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || 'rw-live-secret-key-32chars-long!!'

// Derive a 32-byte key using SHA-256
const getDerivedKey = () => crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest()

/**
 * Encrypt a text string using AES-256-GCM.
 * Returns format: iv:authTag:encryptedText (hex encoded)
 */
export function encryptText(text) {
  if (!text) return ''
  try {
    const iv = crypto.randomBytes(12)
    const key = getDerivedKey()
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return `${iv.toString('hex')}:${authTag}:${encrypted}`
  } catch (err) {
    console.error('Encryption error:', err)
    return text
  }
}

/**
 * Decrypt a ciphertext string formatted as iv:authTag:encryptedText.
 */
export function decryptText(encryptedValue) {
  if (!encryptedValue) return ''
  if (!encryptedValue.includes(':')) return encryptedValue // Return plain if not encrypted format
  try {
    const parts = encryptedValue.split(':')
    if (parts.length !== 3) return encryptedValue

    const [ivHex, authTagHex, encryptedText] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const key = getDerivedKey()

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('Decryption error:', err.message)
    return ''
  }
}

/**
 * Safely mask an API Key (e.g. sk_live_1234567890abcdef -> sk_live_1234...cdef)
 */
export function maskApiKey(key) {
  if (!key) return ''
  if (key.length <= 12) return '***'
  const prefix = key.slice(0, 8)
  const suffix = key.slice(-4)
  return `${prefix}...${suffix}`
}
