import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { getDriveAuth, getDriveAuthStatus } from './googleDriveAuth.js'

const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

if (!driveFolderId) {
  console.warn('Warning: GOOGLE_DRIVE_FOLDER_ID is not set.')
}

/** Required for Shared Drives and correct quota attribution on folder uploads. */
const GDRIVE_ALL = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
}

const { auth, mode: driveAuthMode } = getDriveAuth()
const drive = auth ? google.drive({ version: 'v3', auth }) : null

const isServiceAccountQuotaError = (error) => {
  const message = JSON.stringify(error?.response?.data || error?.message || error)
  return /Service Accounts do not have storage quota|storage quota/i.test(message)
}

const withDriveUploadHelp = (error) => {
  if (driveAuthMode !== 'service_account' || !isServiceAccountQuotaError(error)) {
    return error
  }

  const helpful = new Error(
    'Google Drive upload failed because the app is using a service account, and Google does not give service accounts personal Drive storage quota. Configure Google OAuth with your 5TB Drive account (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN) or upload into a real Google Workspace Shared Drive.',
  )
  helpful.cause = error
  helpful.response = error?.response
  return helpful
}

export const getDriveStorageStatus = () => getDriveAuthStatus()

export const streamDriveFile = async ({ fileId, range }) => {
  if (!drive) throw new Error('Google Drive not configured.')
  return drive.files.get(
    {
      ...GDRIVE_ALL,
      fileId,
      alt: 'media',
    },
    {
      responseType: 'stream',
      headers: range ? { Range: range } : undefined,
    },
  )
}

export const getDriveFileMediaMetadata = async ({ fileId }) => {
  if (!drive) throw new Error('Google Drive not configured.')
  const response = await drive.files.get({
    ...GDRIVE_ALL,
    fileId,
    fields: 'id, name, size, mimeType',
  })
  return response.data
}

const streamText = (value) => Readable.from([value])
const streamBuffer = (value) => Readable.from([value])

export const uploadBufferToDriveFolder = async ({
  buffer,
  fileName,
  mimeType,
  parentFolderId,
}) => {
  if (!drive) throw new Error('Google Drive not configured.')
  const targetFolderId = parentFolderId || driveFolderId
  if (!targetFolderId) throw new Error('Google Drive folder is not configured.')

  let response
  try {
    response = await drive.files.create({
      ...GDRIVE_ALL,
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType,
        body: streamBuffer(buffer),
      },
      fields: 'id, webViewLink, webContentLink',
    })
  } catch (error) {
    throw withDriveUploadHelp(error)
  }

  await drive.permissions.create({
    ...GDRIVE_ALL,
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  const withLinks = await drive.files.get({
    ...GDRIVE_ALL,
    fileId: response.data.id,
    fields: 'id, webViewLink, webContentLink',
  })

  return {
    fileId: withLinks.data.id,
    webViewLink: withLinks.data.webViewLink,
    webContentLink: withLinks.data.webContentLink,
    drivePath: path.posix.join(targetFolderId, fileName),
  }
}

export const uploadVideoToDrive = async ({ filePath, appId, timestamp }) => {
  if (!drive || !driveFolderId) throw new Error('Google Drive not configured.')
  const fileName = `${appId}-${timestamp}.mp4`
  let response
  try {
    response = await drive.files.create({
      ...GDRIVE_ALL,
      requestBody: {
        name: fileName,
        parents: [driveFolderId],
      },
      media: {
        mimeType: 'video/mp4',
        body: fs.createReadStream(filePath),
      },
      fields: 'id, webViewLink, webContentLink',
    })
  } catch (error) {
    throw withDriveUploadHelp(error)
  }

  const fileId = response.data.id
  await drive.permissions.create({
    ...GDRIVE_ALL,
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  const withLinks = await drive.files.get({
    ...GDRIVE_ALL,
    fileId,
    fields: 'id, webViewLink, webContentLink',
  })

  return {
    fileId,
    fileName,
    folderId: driveFolderId,
    webViewLink: withLinks.data.webViewLink,
    webContentLink: withLinks.data.webContentLink,
    drivePath: path.posix.join(driveFolderId, fileName),
  }
}

export const ensureSubFolder = async ({ parentFolderId, folderName }) => {
  if (!drive) throw new Error('Google Drive not configured.')
  const escapedName = folderName.replace(/'/g, "\\'")
  const existing = await drive.files.list({
    ...GDRIVE_ALL,
    q: `'${parentFolderId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
  })

  if (existing.data.files?.length) {
    return existing.data.files[0].id
  }

  const created = await drive.files.create({
    ...GDRIVE_ALL,
    requestBody: {
      name: folderName,
      parents: [parentFolderId],
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  })
  return created.data.id
}

export const uploadVideoToDriveFolder = async ({
  filePath,
  appId,
  timestamp,
  parentFolderId,
}) => {
  if (!drive) throw new Error('Google Drive not configured.')
  const fileName = `${appId}-${timestamp}.mp4`
  let response
  try {
    response = await drive.files.create({
      ...GDRIVE_ALL,
      requestBody: {
        name: fileName,
        parents: [parentFolderId],
      },
      media: {
        mimeType: 'video/mp4',
        body: fs.createReadStream(filePath),
      },
      fields: 'id, webViewLink, webContentLink',
    })
  } catch (error) {
    throw withDriveUploadHelp(error)
  }

  await drive.permissions.create({
    ...GDRIVE_ALL,
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  const withLinks = await drive.files.get({
    ...GDRIVE_ALL,
    fileId: response.data.id,
    fields: 'id, webViewLink, webContentLink',
  })

  return {
    fileId: withLinks.data.id,
    webViewLink: withLinks.data.webViewLink,
    webContentLink: withLinks.data.webContentLink,
    drivePath: path.posix.join(parentFolderId, fileName),
  }
}

export const createDriveTestDocument = async () => {
  if (!drive || !driveFolderId) throw new Error('Google Drive not configured.')
  const timestamp = Date.now()
  const testContent = `Review World Drive test: ${new Date(timestamp).toISOString()}`
  let response
  try {
    response = await drive.files.create({
      ...GDRIVE_ALL,
      requestBody: {
        name: `rw-drive-test-${timestamp}.txt`,
        parents: [driveFolderId],
        mimeType: 'text/plain',
      },
      media: {
        mimeType: 'text/plain',
        body: streamText(testContent),
      },
      fields: 'id, webViewLink, webContentLink',
    })
  } catch (error) {
    throw withDriveUploadHelp(error)
  }

  await drive.permissions.create({
    ...GDRIVE_ALL,
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  const fileInfo = await drive.files.get({
    ...GDRIVE_ALL,
    fileId: response.data.id,
    fields: 'id, webViewLink, webContentLink, name',
  })

  return {
    fileId: fileInfo.data.id,
    fileName: fileInfo.data.name,
    webViewLink: fileInfo.data.webViewLink,
    webContentLink: fileInfo.data.webContentLink,
    folderId: driveFolderId,
  }
}

export const moveFileToBackup = async ({ fileId, backupFolderId }) => {
  if (!drive) throw new Error('Google Drive not configured.')
  if (!fileId || !backupFolderId) return

  try {
    const file = await drive.files.get({
      ...GDRIVE_ALL,
      fileId: fileId,
      fields: 'parents',
    })
    const previousParents = file.data.parents?.join(',')

    await drive.files.update({
      ...GDRIVE_ALL,
      fileId: fileId,
      addParents: backupFolderId,
      removeParents: previousParents,
      fields: 'id, parents',
    })
    console.log(`Successfully moved file ${fileId} to backup folder ${backupFolderId}`)
  } catch (err) {
    console.error(`Failed to move file ${fileId} to backup:`, err.message)
  }
}

export const renameDriveFile = async (fileId, newName) => {
  if (!drive) throw new Error('Google Drive not configured.')
  try {
    await drive.files.update({
      ...GDRIVE_ALL,
      fileId: fileId,
      requestBody: {
        name: newName,
      },
    })
    console.log(`Successfully renamed Drive file ${fileId} to ${newName}`)
  } catch (err) {
    console.error(`Failed to rename Drive file ${fileId}:`, err.message)
  }
}
