import { 
  getAppsLocal, 
  createAppLocal, 
  updateAppLocal, 
  deleteAppLocal, 
  getClientsLocal, 
  createClientLocal, 
  updateClientLocal, 
  deleteClientLocal, 
  getProofsLocal, 
  createProofLocal,
  getPasswordRequestsLocal,
  updatePasswordRequestStatusLocal
} from '../server/dataService.js'
import { readActiveUserFromRequest } from '../server/auth.js'
import { createProofVideoToken } from '../server/auth.js'
import { getUsers, updateUserById, saveUsers } from '../server/userStore.js'
import localDb from '../server/localDb.js'
import { assertCanCreateApp, getValidUntilForPlan } from '../server/subscription.js'
import { getSubscriptionPlan } from '../shared/subscriptionPlans.js'

const toAdminSafeUser = ({ passwordHash, telegramBotToken, telegramChatId, ...user }) => ({
  ...user,
  hasTelegramBotToken: Boolean(telegramBotToken),
  hasTelegramChatId: Boolean(telegramChatId),
})

const REVIEW_LIST_COLUMNS = `
  id, appId, packageId, userName, userImage, rating, date, status, reviewKey,
  reviewDayNumber, hintCategory, ownerUserId, firstSeenAt, liveAt, droppedAt,
  createdAt, updatedAt, replyDate, thumbsUpCount
`

const withPlayableProofUrls = (proofs) =>
  proofs.map((proof) => {
    const token = createProofVideoToken(proof.id)
    const playableUrl = `/api/proof-video?proofId=${encodeURIComponent(proof.id)}&token=${encodeURIComponent(token)}`
    return {
      ...proof,
      videoUrl: playableUrl,
      downloadUrl: playableUrl,
      driveWebViewLink: proof.videoUrl?.startsWith('http') ? proof.videoUrl : null,
    }
  })

export default async function handler(req, res) {
  try {
    const authUser = await readActiveUserFromRequest(req)
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    const user = authUser
    const isAdmin = user.role === 'admin'
    const { method } = req

    // 1. HANDLE GET REQUESTS
    if (method === 'GET') {
      const { type } = req.query
      if (!type) return res.status(400).json({ error: 'Type required' })
      
      // Privacy Fix: Always filter by the current logged-in user's ID
      // No one can see another user's dashboard data.
      const targetUserId = user.id

      switch (type) {
        case 'apps':
          return res.status(200).json(getAppsLocal(targetUserId))
        case 'clients':
          return res.status(200).json(getClientsLocal(targetUserId))
        case 'proofs':
          const targetProofs = localDb.prepare('SELECT * FROM proofs WHERE ownerUserId = ? ORDER BY createdAt DESC').all(user.id)
          return res.status(200).json(withPlayableProofUrls(targetProofs))
        case 'reviews':
          if (isAdmin) {
            const allReviews = localDb.prepare(`SELECT ${REVIEW_LIST_COLUMNS} FROM reviews ORDER BY datetime(date) DESC, rowid DESC`).all()
            return res.status(200).json(allReviews)
          }
          const userReviews = localDb.prepare(`SELECT ${REVIEW_LIST_COLUMNS} FROM reviews WHERE ownerUserId = ? ORDER BY datetime(date) DESC, rowid DESC`).all(user.id)
          return res.status(200).json(userReviews)
        case 'users':
          if (!isAdmin) return res.status(403).json({ error: 'Forbidden' })
          return res.status(200).json(getUsers().map(toAdminSafeUser))
        case 'password_requests':
          if (!isAdmin) return res.status(403).json({ error: 'Forbidden' })
          return res.status(200).json(getPasswordRequestsLocal())
        default:
          return res.status(400).json({ error: `Invalid GET type: ${type}` })
      }
    }

    // 2. HANDLE POST REQUESTS
    if (method === 'POST') {
      const { type, ...payload } = req.body
      if (!type) return res.status(400).json({ error: 'Type required' })
      
      switch (type) {
        case 'app':
          assertCanCreateApp(user)
          if (!payload.name || !payload.packageId || !payload.clientId) {
            return res.status(400).json({ error: 'App name, Package ID, and Client ID are required' })
          }
          const newApp = await createAppLocal({ ...payload, ownerUserId: user.id })
          return res.status(200).json(newApp)
        case 'client':
          if (!payload.name) return res.status(400).json({ error: 'Client name is required' })
          const newClient = await createClientLocal({ ...payload, ownerUserId: user.id })
          return res.status(200).json(newClient)
        default:
          return res.status(400).json({ error: `Invalid POST type: ${type}` })
      }
    }

    // 3. HANDLE PUT REQUESTS
    if (method === 'PUT') {
      const { type, id, ...payload } = req.body
      if (!type) return res.status(400).json({ error: 'Type required' })
      if (!id) return res.status(400).json({ error: 'ID required' })

      switch (type) {
        case 'app': {
          const app = localDb.prepare('SELECT * FROM apps WHERE id = ?').get(id)
          if (!app) return res.status(404).json({ error: 'App not found' })
          if (!isAdmin && app.ownerUserId !== user.id) return res.status(403).json({ error: 'Forbidden' })
          const updated = await updateAppLocal(id, payload)
          return res.status(200).json(updated)
        }
        case 'client': {
          const client = localDb.prepare('SELECT * FROM clients WHERE id = ?').get(id)
          if (!client) return res.status(404).json({ error: 'Client not found' })
          if (!isAdmin && client.ownerUserId !== user.id) return res.status(403).json({ error: 'Forbidden' })
          const updated = await updateClientLocal(id, payload)
          return res.status(200).json(updated)
        }
        case 'user': {
          if (!isAdmin) return res.status(403).json({ error: 'Forbidden' })
          const nextPayload = { ...payload }
          if (typeof nextPayload.telegramBotToken === 'string') {
            nextPayload.telegramBotToken = nextPayload.telegramBotToken.trim()
            if (!nextPayload.telegramBotToken) delete nextPayload.telegramBotToken
          }
          if (typeof nextPayload.telegramChatId === 'string') {
            nextPayload.telegramChatId = nextPayload.telegramChatId.trim()
            if (!nextPayload.telegramChatId) delete nextPayload.telegramChatId
          }
          if (Object.prototype.hasOwnProperty.call(nextPayload, 'accessPlan')) {
            const planId = nextPayload.accessPlan
            if (!['free', 'lifetime'].includes(planId) && !getSubscriptionPlan(planId)) {
              return res.status(400).json({ error: 'Invalid access plan' })
            }
            const existingUser = getUsers().find((u) => u.id === id)
            nextPayload.validUntil = getValidUntilForPlan(planId, existingUser)
          }
          const updated = updateUserById(id, nextPayload)
          return res.status(200).json(toAdminSafeUser(updated))
        }
        case 'password_request': {
          if (!isAdmin) return res.status(403).json({ error: 'Forbidden' })
          if (!payload.status) return res.status(400).json({ error: 'Status required' })
          const updated = await updatePasswordRequestStatusLocal(id, payload.status)
          return res.status(200).json(updated)
        }
        default:
          return res.status(400).json({ error: `Invalid PUT type: ${type}` })
      }
    }

    // 4. HANDLE DELETE REQUESTS
    if (method === 'DELETE') {
      const { type, id } = req.query
      if (!type) return res.status(400).json({ error: 'Type required' })
      if (!id) return res.status(400).json({ error: 'ID required' })

      switch (type) {
        case 'user':
          if (!isAdmin) return res.status(403).json({ error: 'Forbidden' })
          if (id === user.id) return res.status(400).json({ error: 'Cannot delete yourself' })
          const users = getUsers().filter(u => u.id !== id)
          saveUsers(users)
          return res.status(200).json({ ok: true })
        case 'app': {
          const app = localDb.prepare('SELECT * FROM apps WHERE id = ?').get(id)
          if (!app) return res.status(404).json({ error: 'App not found' })
          if (!isAdmin && app.ownerUserId !== user.id) return res.status(403).json({ error: 'Forbidden' })
          await deleteAppLocal(id)
          return res.status(200).json({ ok: true })
        }
        case 'client': {
          const client = localDb.prepare('SELECT * FROM clients WHERE id = ?').get(id)
          if (!client) return res.status(404).json({ error: 'Client not found' })
          if (!isAdmin && client.ownerUserId !== user.id) return res.status(403).json({ error: 'Forbidden' })
          const apps = localDb.prepare('SELECT id FROM apps WHERE clientId = ?').all(id)
          if (apps.length > 0) return res.status(400).json({ error: 'Cannot delete client with active apps' })
          await deleteClientLocal(id)
          return res.status(200).json({ ok: true })
        }
        default:
          return res.status(400).json({ error: `Invalid DELETE type: ${type}` })
      }
    }

    // Default 405 for other methods
    return res.status(405).json({ error: `Method ${method} not allowed` })

  } catch (error) {
    console.error(`CRITICAL Error in API handler:`, error)
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal Server Error' : error.message,
      details: error.message,
    })
  }
}
