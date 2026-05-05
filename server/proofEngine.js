import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebaseAdmin.js'
import {
  ensureSubFolder,
  uploadVideoToDriveFolder,
} from './driveStorage.js'

ffmpeg.setFfmpegPath(ffmpegStatic)

const TEMP_DIR = path.resolve(process.cwd(), '.tmp-proof')

const ensureTempDir = async () => {
  await fs.mkdir(TEMP_DIR, { recursive: true })
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const convertWebmToMp4 = (inputFile, outputFile) =>
  new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .outputOptions([
        '-c:v libx264',
        '-preset slow',
        '-crf 18',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
      ])
      .toFormat('mp4')
      .save(outputFile)
      .on('end', () => resolve(outputFile))
      .on('error', reject)
  })

const getRecordUrl = (appId) => {
  const baseUrl = process.env.PORTAL_BASE_URL ?? 'http://localhost:5173'
  return `${baseUrl}/record/${appId}`
}

export const generateProofForApp = async (appDoc) => {
  await ensureTempDir()
  const appId = appDoc.id
  const now = Date.now()
  const webmPath = path.join(TEMP_DIR, `${appId}-${now}.webm`)
  const mp4Path = path.join(TEMP_DIR, `${appId}-${now}.mp4`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    recordVideo: {
      dir: TEMP_DIR,
      size: { width: 1366, height: 768 },
    },
  })

  try {
    const page = await context.newPage()
    await page.goto(getRecordUrl(appId), { waitUntil: 'networkidle' })

    for (let i = 0; i < 14; i += 1) {
      await page.mouse.wheel(0, 900)
      await wait(900 + Math.floor(Math.random() * 600))
    }

    await wait(2000)
    const video = await page.video()
    await context.close()
    await browser.close()

    const videoPath = await video.path()
    await fs.copyFile(videoPath, webmPath)
    await convertWebmToMp4(webmPath, mp4Path)

    const appData = appDoc.data()
    const ownerUserId = appData.ownerUserId ?? null
    const ownerUserDoc = ownerUserId
      ? await adminDb.collection('users').doc(ownerUserId).get()
      : null
    const ownerRootFolderId = ownerUserDoc?.exists
      ? ownerUserDoc.data().driveFolderId
      : process.env.GOOGLE_DRIVE_FOLDER_ID
    const dateFolderName = new Date(now).toISOString().slice(0, 10)
    const appFolderName = (appData.name ?? appData.packageId ?? appId).replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    )

    const dateFolderId = await ensureSubFolder({
      parentFolderId: ownerRootFolderId,
      folderName: dateFolderName,
    })
    const appFolderId = await ensureSubFolder({
      parentFolderId: dateFolderId,
      folderName: appFolderName,
    })

    const driveUpload = await uploadVideoToDriveFolder({
      filePath: mp4Path,
      appId,
      timestamp: now,
      parentFolderId: appFolderId,
    })

    await adminDb.collection('proofs').add({
      appId,
      ownerUserId,
      appName: appData.name ?? appData.packageId,
      videoUrl: driveUpload.webViewLink,
      downloadUrl: driveUpload.webContentLink,
      storagePath: driveUpload.drivePath,
      driveFileId: driveUpload.fileId,
      createdAt: FieldValue.serverTimestamp(),
      day: 'Day 7',
      status: 'READY',
    })

    await adminDb.collection('apps').doc(appId).set(
      {
        proofStatus: 'Proof Generated',
        ownerUserId,
        proofWebViewLink: driveUpload.webViewLink,
        proofDriveFileId: driveUpload.fileId,
        lastProofAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    await fs.rm(webmPath, { force: true })
    await fs.rm(mp4Path, { force: true })
    return {
      appId,
      driveFileId: driveUpload.fileId,
      videoUrl: driveUpload.webViewLink,
      downloadUrl: driveUpload.webContentLink,
    }
  } finally {
    try {
      await context.close()
    } catch (error) {
      console.warn('Context close skipped:', error.message)
    }
    try {
      await browser.close()
    } catch (error) {
      console.warn('Browser close skipped:', error.message)
    }
  }
}

export const generateDueProofs = async () => {
  const nowMs = Date.now()
  const appSnapshot = await adminDb
    .collection('apps')
    .where('monitoringStatus', '==', 'ACTIVE')
    .get()

  const dueApps = appSnapshot.docs.filter((appDoc) => {
    const createdAt = appDoc.data().createdAt?.toDate?.() ?? new Date()
    const ageDays = Math.floor((nowMs - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    const proofStatus = appDoc.data().proofStatus
    return ageDays >= 7 && proofStatus !== 'Proof Generated'
  })

  const generated = []
  for (const appDoc of dueApps) {
    generated.push(await generateProofForApp(appDoc))
  }
  return generated
}
