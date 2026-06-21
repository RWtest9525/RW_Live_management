import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'url'
import { google } from 'googleapis'
import { getDriveAuth } from './googleDriveAuth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
const { auth } = getDriveAuth()
const drive = auth ? google.drive({ version: 'v3', auth }) : null

const reviewsDbLocal = path.resolve(__dirname, '../reviews.db')
const usersJsonLocal = path.resolve(__dirname, '../data/users.json')

export const restoreDbFromDrive = async () => {
  if (!drive || !driveFolderId) {
    console.warn('[backup] Google Drive not configured. Skipping DB restore.')
    return
  }

  console.log('[backup] Checking for database backups on Google Drive...')
  try {
    const response = await drive.files.list({
      q: `'${driveFolderId}' in parents and (name = 'reviews.db' or name = 'users.json') and trashed = false`,
      fields: 'files(id, name)',
    })

    const files = response.data.files || []
    for (const file of files) {
      if (file.name === 'reviews.db') {
        console.log('[backup] Found reviews.db in Google Drive. Downloading...')
        const dest = fs.createWriteStream(reviewsDbLocal)
        const res = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'stream' }
        )
        await new Promise((resolve, reject) => {
          res.data
            .pipe(dest)
            .on('finish', resolve)
            .on('error', reject)
        })
        console.log('[backup] Successfully restored reviews.db from Google Drive.')
      } else if (file.name === 'users.json') {
        console.log('[backup] Found users.json in Google Drive. Downloading...')
        // Ensure data directory exists
        const dir = path.dirname(usersJsonLocal)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        const dest = fs.createWriteStream(usersJsonLocal)
        const res = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'stream' }
        )
        await new Promise((resolve, reject) => {
          res.data
            .pipe(dest)
            .on('finish', resolve)
            .on('error', reject)
        })
        console.log('[backup] Successfully restored users.json from Google Drive.')
      }
    }
  } catch (error) {
    console.error('[backup] Failed to restore database from Google Drive:', error.message)
  }
}

export const backupDbToDrive = async () => {
  if (!drive || !driveFolderId) {
    console.warn('[backup] Google Drive not configured. Skipping DB backup.')
    return
  }

  console.log('[backup] Backing up database to Google Drive...')
  try {
    // 1. Find existing backup files
    const response = await drive.files.list({
      q: `'${driveFolderId}' in parents and (name = 'reviews.db' or name = 'users.json') and trashed = false`,
      fields: 'files(id, name)',
    })
    const files = response.data.files || []
    const fileMap = {}
    files.forEach((f) => {
      fileMap[f.name] = f.id
    })

    // 2. Backup reviews.db
    if (fs.existsSync(reviewsDbLocal)) {
      if (fileMap['reviews.db']) {
        // Update existing file
        await drive.files.update({
          fileId: fileMap['reviews.db'],
          media: {
            mimeType: 'application/octet-stream',
            body: fs.createReadStream(reviewsDbLocal),
          },
        })
        console.log('[backup] Updated reviews.db backup on Google Drive.')
      } else {
        // Create new file
        await drive.files.create({
          requestBody: {
            name: 'reviews.db',
            parents: [driveFolderId],
          },
          media: {
            mimeType: 'application/octet-stream',
            body: fs.createReadStream(reviewsDbLocal),
          },
        })
        console.log('[backup] Created reviews.db backup on Google Drive.')
      }
    }

    // 3. Backup users.json
    if (fs.existsSync(usersJsonLocal)) {
      if (fileMap['users.json']) {
        await drive.files.update({
          fileId: fileMap['users.json'],
          media: {
            mimeType: 'application/json',
            body: fs.createReadStream(usersJsonLocal),
          },
        })
        console.log('[backup] Updated users.json backup on Google Drive.')
      } else {
        await drive.files.create({
          requestBody: {
            name: 'users.json',
            parents: [driveFolderId],
          },
          media: {
            mimeType: 'application/json',
            body: fs.createReadStream(usersJsonLocal),
          },
        })
        console.log('[backup] Created users.json backup on Google Drive.')
      }
    }
  } catch (error) {
    console.error('[backup] Failed to backup database to Google Drive:', error.message)
  }
}
