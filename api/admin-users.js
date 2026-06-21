import { readAuthUserFromRequest } from '../server/auth.js'
import { createUser, getUsers, saveUsers } from '../server/userStore.js'
import { ensureSubFolder } from '../server/driveStorage.js'
import { getSubscriptionPlan } from '../shared/subscriptionPlans.js'
import { getValidUntilForPlan } from '../server/subscription.js'

const toAdminSafeUser = ({ passwordHash, telegramBotToken, telegramChatId, ...user }) => ({
  ...user,
  hasTelegramBotToken: Boolean(telegramBotToken),
  hasTelegramChatId: Boolean(telegramChatId),
})

export default async function handler(req, res) {
  const { method } = req

  try {
    const authUser = await readAuthUserFromRequest(req)
    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    if (method === 'GET') {
      const users = getUsers().map(toAdminSafeUser)
      return res.status(200).json(users)
    }

    if (method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'User ID required' })
      const users = getUsers().filter(u => u.id !== id)
      saveUsers(users)
      return res.status(200).json({ ok: true })
    }

    if (method === 'POST') {
      const {
        name,
        email,
        phone,
        password,
        accessPlan = 'free',
        telegramBotToken = '',
        telegramChatId = '',
      } = req.body ?? {}
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email and password are required' })
      }

      if (!['free', 'lifetime'].includes(accessPlan) && !getSubscriptionPlan(accessPlan)) {
        return res.status(400).json({ error: 'Invalid access plan' })
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
        phone: phone ?? '', 
        password, 
        role: 'user', 
        accessPlan,
        validUntil: getValidUntilForPlan(accessPlan),
        driveFolderId: driveFolderId,
        backupFolderId: backupFolderId,
        telegramBotToken: telegramBotToken.trim(),
        telegramChatId: telegramChatId.trim(),
      })

      return res.status(200).json({
        ok: true,
        user: toAdminSafeUser(newUser),
      })
    }

    return res.status(405).json({ error: `Method ${method} not allowed` })
  } catch (error) {
    console.error('Error in admin-users handler:', error)
    return res.status(500).json({ error: error.message })
  }
}
