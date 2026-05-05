import fs from 'node:fs'
import path from 'node:path'
import { google } from 'googleapis'
import { serviceAccount } from './firebaseAdmin.js'

const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

if (!driveFolderId) {
  throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID environment variable.')
}

const auth = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ['https://www.googleapis.com/auth/drive'],
})

const drive = google.drive({ version: 'v3', auth })

export const uploadVideoToDrive = async ({ filePath, appId, timestamp }) => {
  const fileName = `${appId}-${timestamp}.mp4`
  const response = await drive.files.create({
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

  const fileId = response.data.id
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  const withLinks = await drive.files.get({
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
  const escapedName = folderName.replace(/'/g, "\\'")
  const existing = await drive.files.list({
    q: `'${parentFolderId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
  })

  if (existing.data.files?.length) {
    return existing.data.files[0].id
  }

  const created = await drive.files.create({
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
  const fileName = `${appId}-${timestamp}.mp4`
  const response = await drive.files.create({
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

  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  const withLinks = await drive.files.get({
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
  const timestamp = Date.now()
  const testContent = `Review World Drive test: ${new Date(timestamp).toISOString()}`
  const response = await drive.files.create({
    requestBody: {
      name: `rw-drive-test-${timestamp}.txt`,
      parents: [driveFolderId],
      mimeType: 'text/plain',
    },
    media: {
      mimeType: 'text/plain',
      body: Buffer.from(testContent),
    },
    fields: 'id, webViewLink, webContentLink',
  })

  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  const fileInfo = await drive.files.get({
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
