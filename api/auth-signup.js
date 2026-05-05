import bcrypt from 'bcryptjs'
import { FieldValue } from 'firebase-admin/firestore'
import { ensureSubFolder } from '../server/driveStorage.js'
import { adminDb } from '../server/firebaseAdmin.js'

const rootDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

const addMonths = (date, months) => {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { name, phone, country, email, password } = req.body ?? {}
    if (!name || !phone || !country || !email || !password) {
      return res.status(400).json({
        error: 'name, phone, country, email and password are required',
      })
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

    const userRootFolderName = `${name}-${normalizedEmail}`.replace(
      /[^a-zA-Z0-9@._-]/g,
      '_',
    )
    const userDriveFolderId = await ensureSubFolder({
      parentFolderId: rootDriveFolderId,
      folderName: userRootFolderName,
    })

    const passwordHash = await bcrypt.hash(password, 10)
    const validUntilDate = addMonths(new Date(), 1)
    const userRef = await adminDb.collection('users').add({
      name,
      email: normalizedEmail,
      phone,
      country,
      role: 'user',
      accessPlan: 'trial',
      validUntil: validUntilDate.toISOString(),
      passwordHash,
      status: 'active',
      driveFolderId: userDriveFolderId,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: 'self-signup',
    })

    return res.status(200).json({
      ok: true,
      user: {
        id: userRef.id,
        name,
        phone,
        country,
        email: normalizedEmail,
      },
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
