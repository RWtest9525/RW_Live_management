import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebaseAdmin.js'

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'rw-dev-secret-change-me'
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'reviewsworld01@gmail.com').toLowerCase()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ReviewWorld@123'

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

  const payload = JSON.parse(base64UrlDecode(encodedPayload))
  if (payload.exp < Date.now()) return null
  return payload
}

export const readAuthUserFromRequest = async (req) => {
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const session = verifySessionToken(token)
  if (!session) return null
  const userDoc = await adminDb.collection('users').doc(session.uid).get()
  if (!userDoc.exists) return null
  return { id: userDoc.id, ...userDoc.data() }
}

export const ensureAdminUser = async () => {
  const usersRef = adminDb.collection('users')
  const snapshot = await usersRef.where('email', '==', ADMIN_EMAIL).limit(1).get()
  if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const ref = await usersRef.add({
    name: 'Review World Admin',
    email: ADMIN_EMAIL,
    phone: '',
    role: 'admin',
    accessPlan: 'lifetime',
    validUntil: null,
    passwordHash,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
  })

  return {
    id: ref.id,
    name: 'Review World Admin',
    email: ADMIN_EMAIL,
    role: 'admin',
    accessPlan: 'lifetime',
    validUntil: null,
    status: 'active',
    phone: '',
    passwordHash,
  }
}

export const authenticateUser = async ({ email, password }) => {
  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  if (!normalizedEmail || !password) return null

  if (normalizedEmail === ADMIN_EMAIL) {
    await ensureAdminUser()
  }

  const snapshot = await adminDb
    .collection('users')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get()
  if (snapshot.empty) return null

  const userDoc = snapshot.docs[0]
  const user = { id: userDoc.id, ...userDoc.data() }
  if (user.status !== 'active') return null

  if (user.validUntil) {
    const expiryMs = new Date(user.validUntil).getTime()
    if (!Number.isNaN(expiryMs) && expiryMs < Date.now()) return null
  }

  const ok = await bcrypt.compare(password, user.passwordHash ?? '')
  if (!ok) return null
  return user
}
