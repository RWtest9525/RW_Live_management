import localDb from './localDb.js'
import crypto from 'node:crypto'
import { ensureSubFolder, moveFileToBackup } from './driveStorage.js'
import { getUsers, setUserPasswordById } from './userStore.js'

const runInBackground = (label, task) => {
  setTimeout(async () => {
    try {
      await task()
    } catch (err) {
      console.error(`${label}:`, err.message)
    }
  }, 0)
}

export const getAppsLocal = (userId = null) => {
  if (userId) {
    return localDb.prepare('SELECT * FROM apps WHERE ownerUserId = ? ORDER BY createdAt DESC').all(userId)
  }
  return localDb.prepare('SELECT * FROM apps ORDER BY createdAt DESC').all()
}

export const getAppLocal = (appId) => {
  return localDb.prepare('SELECT * FROM apps WHERE id = ?').get(appId)
}

export const createAppLocal = async (payload) => {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const stmt = localDb.prepare(`
    INSERT INTO apps (
      id, name, packageId, storeUrl, reviewLink, category, targetCount, 
      ratePerReview, selectedHint, hintMode, monitoringStatus, ownerUserId, 
      clientId, driveFolderId, targetDate, listDate, listTime, stopCheckingAfter, 
      starRating, addedFrom, icon, developer, createdAt, lastSyncedAt
    ) VALUES (
      @id, @name, @packageId, @storeUrl, @reviewLink, @category, @targetCount, 
      @ratePerReview, @selectedHint, @hintMode, @monitoringStatus, @ownerUserId, 
      @clientId, @driveFolderId, @targetDate, @listDate, @listTime, @stopCheckingAfter, 
      @starRating, @addedFrom, @icon, @developer, @createdAt, @lastSyncedAt
    )
  `)
  stmt.run({
    id,
    name: payload.name,
    packageId: payload.packageId,
    storeUrl: payload.storeUrl || '',
    reviewLink: payload.reviewLink || '',
    category: payload.category || 'General',
    targetCount: Number(payload.targetCount || 0),
    ratePerReview: Number(payload.ratePerReview || 10),
    selectedHint: payload.selectedHint || ',',
    hintMode: payload.hintMode || 'strict-hint',
    monitoringStatus: payload.monitoringStatus || 'ACTIVE',
    ownerUserId: payload.ownerUserId,
    clientId: payload.clientId || null,
    driveFolderId: null,
    targetDate: payload.targetDate || now,
    listDate: payload.listDate || '',
    listTime: payload.listTime || '20:00',
    stopCheckingAfter: payload.stopCheckingAfter || null,
    starRating: Number(payload.starRating || 5),
    addedFrom: payload.addedFrom || 'manual',
    icon: payload.icon || '',
    developer: payload.developer || '',
    createdAt: now,
    lastSyncedAt: payload.lastSyncedAt || null
  })

  if (payload.clientId) {
    runInBackground(`Failed to create Drive folder for app ${id}`, async () => {
      const client = localDb.prepare('SELECT * FROM clients WHERE id = ?').get(payload.clientId)
      if (!client?.driveFolderId) return

      let folderDateStr = `${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getFullYear()).slice(-2)}`
      if (payload.listDate) {
        const [y, m, d] = payload.listDate.split('-')
        if (y && m && d) folderDateStr = `${d}-${m}-${y.slice(-2)}`
      }

      const dateFolderId = await ensureSubFolder({
        parentFolderId: client.driveFolderId,
        folderName: folderDateStr,
      })
      const appDriveFolderId = await ensureSubFolder({
        parentFolderId: dateFolderId,
        folderName: payload.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
      })
      localDb.prepare('UPDATE apps SET driveFolderId = ? WHERE id = ?').run(appDriveFolderId, id)
      console.log(`App folder created with ID: ${appDriveFolderId}`)
    })
  }

  return { id, ...payload, driveFolderId: null }
}

export const updateAppLocal = async (id, payload) => {
  const existing = localDb.prepare('SELECT * FROM apps WHERE id = ?').get(id)
  if (!existing) throw new Error('App not found')

  // Handle Drive Folder Renaming if app name changed
  if (payload.name && payload.name !== existing.name && existing.driveFolderId) {
    runInBackground(`Failed to rename Drive folder for app ${id}`, async () => {
      const { renameDriveFile } = await import('./driveStorage.js')
      await renameDriveFile(existing.driveFolderId, payload.name.replace(/[^a-zA-Z0-9._-]/g, '_'))
    })
  }

  const columns = Object.keys(payload).filter(k => k !== 'id' && k !== 'createdAt')
  const setClause = columns.map(col => `${col} = @${col}`).join(', ')
  const stmt = localDb.prepare(`UPDATE apps SET ${setClause} WHERE id = ?`)
  stmt.run({ ...payload }, id)
  return { ...existing, ...payload }
}

export const deleteAppLocal = async (appId) => {
  const app = localDb.prepare('SELECT * FROM apps WHERE id = ?').get(appId)
  let backupFolderId = null
  if (app && app.driveFolderId) {
    const user = getUsers().find(u => u.id === app.ownerUserId)
    if (user && user.backupFolderId) {
      backupFolderId = user.backupFolderId
    }
  }
  localDb.prepare('DELETE FROM apps WHERE id = ?').run(appId)
  localDb.prepare('DELETE FROM reviews WHERE appId = ?').run(appId)
  localDb.prepare('DELETE FROM proofs WHERE appId = ?').run(appId)

  if (app?.driveFolderId && backupFolderId) {
    runInBackground(`Failed to move app folder ${app.driveFolderId} to backup`, async () => {
      console.log(`Moving app folder ${app.driveFolderId} to backup ${backupFolderId}`)
      await moveFileToBackup({
        fileId: app.driveFolderId,
        backupFolderId,
      })
    })
  }
}

// Clients
export const getClientsLocal = (userId = null) => {
  if (userId) {
    return localDb.prepare('SELECT * FROM clients WHERE ownerUserId = ? ORDER BY createdAt DESC').all(userId)
  }
  return localDb.prepare('SELECT * FROM clients ORDER BY createdAt DESC').all()
}

export const createClientLocal = async (payload) => {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  
  // Drive Folder Logic
  let clientFolderId = null
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!rootFolderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set.')
    }

    // Resolve owner user's drive folder as parent, fallback to root folder
    let parentFolderId = rootFolderId
    if (payload.ownerUserId) {
      const user = getUsers().find(u => u.id === payload.ownerUserId)
      if (user && user.driveFolderId) {
        parentFolderId = user.driveFolderId
      }
    }

    console.log(`Creating client folder for ${payload.name} inside parent: ${parentFolderId}`)
    const clientFolderName = payload.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    clientFolderId = await ensureSubFolder({
      parentFolderId,
      folderName: clientFolderName,
    })
    console.log(`Client folder created with ID: ${clientFolderId}`)
  } catch (err) {
    console.error('CRITICAL: Failed to create Drive folder for client:', err.message)
    // We might want to allow client creation even if drive fails, 
    // but the user's request suggests Drive is critical.
    throw new Error(`Google Drive Error: ${err.message}. Client not created.`)
  }

  const stmt = localDb.prepare(`
    INSERT INTO clients (id, name, email, phone, driveFolderId, ownerUserId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(id, payload.name, payload.email || '', payload.phone || '', clientFolderId, payload.ownerUserId, now)
  return { id, ...payload, driveFolderId: clientFolderId }
}

export const updateClientLocal = async (id, payload) => {
  const existing = localDb.prepare('SELECT * FROM clients WHERE id = ?').get(id)
  if (!existing) throw new Error('Client not found')

  // Handle Drive Folder Renaming if client name changed
  if (payload.name && payload.name !== existing.name && existing.driveFolderId) {
    try {
      const { renameDriveFile } = await import('./driveStorage.js')
      await renameDriveFile(existing.driveFolderId, payload.name.replace(/[^a-zA-Z0-9._-]/g, '_'))
    } catch (err) {
      console.error('Failed to rename Drive folder for client:', err.message)
    }
  }

  const columns = Object.keys(payload).filter(k => k !== 'id' && k !== 'createdAt')
  const setClause = columns.map(col => `${col} = @${col}`).join(', ')
  const stmt = localDb.prepare(`UPDATE clients SET ${setClause} WHERE id = ?`)
  stmt.run(payload, id)
  return { ...existing, ...payload }
}

export const deleteClientLocal = async (clientId) => {
  const client = localDb.prepare('SELECT * FROM clients WHERE id = ?').get(clientId)
  if (client && client.driveFolderId) {
    const user = getUsers().find(u => u.id === client.ownerUserId)
    if (user && user.backupFolderId) {
      console.log(`Moving client folder ${client.driveFolderId} to backup ${user.backupFolderId}`)
      await moveFileToBackup({
        fileId: client.driveFolderId,
        backupFolderId: user.backupFolderId
      })
    }
  }
  localDb.prepare('DELETE FROM clients WHERE id = ?').run(clientId)
}

// Proofs
export const getProofsLocal = (userId = null) => {
  if (userId) {
    return localDb.prepare('SELECT * FROM proofs WHERE ownerUserId = ? ORDER BY createdAt DESC').all(userId)
  }
  return localDb.prepare('SELECT * FROM proofs ORDER BY createdAt DESC').all()
}

export const getProofsByClientLocal = (clientId) => {
  return localDb.prepare('SELECT * FROM proofs WHERE clientId = ? ORDER BY createdAt DESC').all(clientId)
}

export const createProofLocal = (payload) => {
  const stmt = localDb.prepare(`
    INSERT INTO proofs (
      id, appId, ownerUserId, clientId, appName, videoUrl, downloadUrl, 
      storagePath, driveFileId, day, date, status, createdAt
    ) VALUES (
      @id, @appId, @ownerUserId, @clientId, @appName, @videoUrl, @downloadUrl, 
      @storagePath, @driveFileId, @day, @date, @status, @createdAt
    )
  `)
  stmt.run(payload)
  return payload
}

export const deleteProofLocal = (proofId) => {
  localDb.prepare('DELETE FROM proofs WHERE id = ?').run(proofId)
}

// Password Requests
export const createPasswordRequestLocal = (payload) => {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const stmt = localDb.prepare(`
    INSERT INTO password_requests (id, userId, email, phone, passwordType, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(id, payload.userId || null, payload.email || '', payload.phone || '', payload.passwordType || '', 'pending', now)
  return { id, ...payload, status: 'pending', createdAt: now }
}

export const getPasswordRequestsLocal = () => {
  return localDb.prepare('SELECT * FROM password_requests ORDER BY createdAt DESC').all()
}

const generateTemporaryPassword = (passwordType = 'standard') => {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase()
  const prefix = passwordType === 'secure' ? 'RW-Secure' : passwordType === 'temporary' ? 'RW-Temp' : 'RW'
  return `${prefix}@${random}`
}

export const updatePasswordRequestStatusLocal = async (id, status) => {
  const existing = localDb.prepare('SELECT * FROM password_requests WHERE id = ?').get(id)
  if (!existing) throw new Error('Password request not found')

  if (status === 'approved') {
    const temporaryPassword = generateTemporaryPassword(existing.passwordType)
    await setUserPasswordById(existing.userId, temporaryPassword)
    const resolvedAt = new Date().toISOString()
    localDb
      .prepare('UPDATE password_requests SET status = ?, temporaryPassword = ?, resolvedAt = ? WHERE id = ?')
      .run(status, temporaryPassword, resolvedAt, id)
    return { ...existing, status, temporaryPassword, resolvedAt }
  }

  const resolvedAt = status === 'rejected' ? new Date().toISOString() : null
  localDb
    .prepare('UPDATE password_requests SET status = ?, resolvedAt = COALESCE(?, resolvedAt) WHERE id = ?')
    .run(status, resolvedAt, id)
  return { ...existing, status, resolvedAt: resolvedAt || existing.resolvedAt }
}
