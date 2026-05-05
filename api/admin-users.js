import bcrypt from 'bcryptjs'
import { FieldValue } from 'firebase-admin/firestore'
import { readAuthUserFromRequest } from '../server/auth.js'
import { ensureSubFolder } from '../server/driveStorage.js'
import { adminDb } from '../server/firebaseAdmin.js'

const rootDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

const addMonths = (date, months) => {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

const resolveValidityDate = (validityMode) => {
  const now = new Date()
  if (validityMode === 'trial') return addMonths(now, 1)
  if (validityMode === '1-month') return addMonths(now, 1)
  if (validityMode === '1-year') return addMonths(now, 12)
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authUser = await readAuthUserFromRequest(req)
    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { name, email, phone, password, validityMode = 'trial' } = req.body ?? {}
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const existing = await adminDb
      .collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get()
    if (!existing.empty) {
      return res.status(409).json({ error: 'User already exists with this email.' })
    }

    const userRootFolderName = `${name}-${normalizedEmail}`.replace(/[^a-zA-Z0-9@._-]/g, '_')
    const userDriveFolderId = await ensureSubFolder({
      parentFolderId: rootDriveFolderId,
      folderName: userRootFolderName,
    })
    const validUntilDate = resolveValidityDate(validityMode)

    const passwordHash = await bcrypt.hash(password, 10)
    const userRef = await adminDb.collection('users').add({
      name,
      email: normalizedEmail,
      phone: phone ?? '',
      role: 'user',
      accessPlan: validityMode,
      validUntil: validUntilDate ? validUntilDate.toISOString() : null,
      passwordHash,
      status: 'active',
      driveFolderId: userDriveFolderId,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: authUser.id,
    })

    return res.status(200).json({
      ok: true,
      user: {
        id: userRef.id,
        name,
        email: normalizedEmail,
        phone: phone ?? '',
        role: 'user',
        accessPlan: validityMode,
        validUntil: validUntilDate ? validUntilDate.toISOString() : null,
        driveFolderId: userDriveFolderId,
      },
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
