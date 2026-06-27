import { createUser, getUsers } from '../server/userStore.js'
import { ensureSubFolder } from '../server/driveStorage.js'

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

    if (getUsers().find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // 1. Create User Folder in Google Drive
    let driveFolderId = null
    let backupFolderId = null
    try {
      const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
      if (rootFolderId) {
        console.log(`Creating user folder for new user: ${name}`)
        driveFolderId = await ensureSubFolder({
          parentFolderId: rootFolderId,
          folderName: name.replace(/[^a-zA-Z0-9._-]/g, '_')
        })
        console.log(`User folder created with ID: ${driveFolderId}`)

        // Create Backup folder inside user folder
        backupFolderId = await ensureSubFolder({
          parentFolderId: driveFolderId,
          folderName: 'BACKUP'
        })
        console.log(`User backup folder created with ID: ${backupFolderId}`)
      }
    } catch (err) {
      console.error('Warning: Failed to create user Drive folders:', err.message)
    }

    const newUser = await createUser({ 
      name, 
      email, 
      phone, 
      password, 
      role: 'user', 
      accessPlan: 'free',
      driveFolderId: driveFolderId,
      backupFolderId: backupFolderId,
    })

    const { passwordHash, ...userWithoutPassword } = newUser
    return res.status(200).json({
      ok: true,
      user: userWithoutPassword,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
