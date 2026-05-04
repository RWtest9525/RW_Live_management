import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, adminStorage } from './firebaseAdmin.js'

ffmpeg.setFfmpegPath(ffmpegStatic)

const TEMP_DIR = path.resolve(process.cwd(), '.tmp-proof')

const ensureTempDir = async () => {
  await fs.mkdir(TEMP_DIR, { recursive: true })
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const convertWebmToMp4 = (inputFile, outputFile) =>
  new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-movflags +faststart'])
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
  const proofPath = `proof-videos/${appId}/${now}.mp4`

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

    await adminStorage.upload(mp4Path, {
      destination: proofPath,
      contentType: 'video/mp4',
      metadata: {
        metadata: {
          appId,
          generatedAt: new Date(now).toISOString(),
        },
      },
    })

    const [signedUrl] = await adminStorage.file(proofPath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365,
    })

    await adminDb.collection('proofs').add({
      appId,
      appName: appDoc.data().name ?? appDoc.data().packageId,
      videoUrl: signedUrl,
      storagePath: proofPath,
      createdAt: FieldValue.serverTimestamp(),
      day: 'Day 7',
      status: 'READY',
    })

    await adminDb.collection('apps').doc(appId).set(
      {
        proofStatus: 'Proof Generated',
        lastProofAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    await fs.rm(webmPath, { force: true })
    await fs.rm(mp4Path, { force: true })
    return { appId, proofPath, videoUrl: signedUrl }
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
