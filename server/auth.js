import crypto from 'node:crypto'
import { authenticateUser as authFromStore, findUserById } from './userStore.js'

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

export const createSignedToken = (payload) => {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export const verifySignedToken = (token) => {
  if (!token || !token.includes('.')) return null
  const [encodedPayload, signature] = token.split('.')
  const expectedSignature = signPayload(encodedPayload)
  if (signature !== expectedSignature) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload))
    if (payload.exp && payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export const createProofVideoToken = (proofId, ttlMs = 1000 * 60 * 60 * 24 * 30) =>
  createSignedToken({
    typ: 'proof-video',
    proofId,
    exp: Date.now() + ttlMs,
  })

export const createExcelDownloadToken = (appId, date, ttlMs = 1000 * 60 * 60 * 24 * 30) =>
  createSignedToken({
    typ: 'excel-download',
    appId,
    date: date || '',
    exp: Date.now() + ttlMs,
  })

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
  
  return findUserById(session.uid)
}

export const readActiveUserFromRequest = (req) => {
  const user = readAuthUserFromRequest(req)
  if (!user) return null
  if (user.status !== 'active' && user.role !== 'admin') return null
  return user
}

export const authenticateUser = async ({ email, password }) => {
  return await authFromStore({ email, password })
}
