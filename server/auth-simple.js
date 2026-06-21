import crypto from 'node:crypto'
import { ensureAdminUser } from './userStore.js'

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'rw-dev-secret-change-me'

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url')
const base64UrlDecode = (value) => Buffer.from(value, 'base64url').toString('utf8')

const signPayload = (payload) =>
  crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url')

export const createSessionToken = (user) => {
  const payload = JSON.stringify({
    uid: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  })
  const encodedPayload = base64UrlEncode(payload)
  const signature = signPayload(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export const verifySessionToken = (token) => {
  if (!token || !token.includes('.')) return null
  const [encodedPayload, signature] = token.split('.')
  const expectedSignature = signPayload(encodedPayload)
  if (signature !== expectedSignature) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload))
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export const readAuthUserFromRequest = (req) => {
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const session = verifySessionToken(token)
  if (!session) return null
  
  const { findUserById } = require('./userStore.js')
  return findUserById(session.uid)
}

export const authenticateUserSimple = async ({ email, password }) => {
  return await ensureAdminUser({ email, password })
}
