import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import localDb from './localDb.js'
import { updateAppLocal, createProofLocal } from './dataService.js'
import {
  ensureSubFolder,
  uploadVideoToDriveFolder,
} from './driveStorage.js'
import { createProofVideoToken, createSessionToken } from './auth.js'
import { findUserById } from './userStore.js'
import { serviceAccount } from './googleServiceAccount.js'
import { getDriveAuth } from './googleDriveAuth.js'

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
        '-preset veryslow',
        '-crf 10',
        '-r 30',
        '-vf scale=1920:1080:flags=lanczos',
        '-b:v 12000k',
        '-maxrate 16000k',
        '-bufsize 24000k',
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

const createProofVideoUrl = (proofId) => {
  const token = createProofVideoToken(proofId)
  return `/api/proof-video?proofId=${encodeURIComponent(proofId)}&token=${encodeURIComponent(token)}`
}

const waitForRecordPageReady = async (page) => {
  await page.waitForFunction(
    () => {
      const pageReady = document.querySelector('[data-record-ready="true"]')
      const hasReviews = document.querySelectorAll('article').length > 0
      const hasEmptyState = document.body.innerText.includes('No verified reviews loaded yet')
      return pageReady && (hasReviews || hasEmptyState)
    },
    null,
    { timeout: 15000 },
  ).catch(() => {})
  await wait(1200)
}

const smoothHumanScrollToEnd = async (page) => {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const root = document.scrollingElement || document.documentElement
    const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight)

    await sleep(900)

    if (maxScroll() <= 8) {
      await sleep(1200)
      return { reachedEnd: true, distance: 0 }
    }

    let lastY = root.scrollTop
    let stillFrames = 0
    let totalDistance = 0
    const startedAt = performance.now()
    const maxDurationMs = 120000

    while (performance.now() - startedAt < maxDurationMs) {
      const remaining = maxScroll() - root.scrollTop
      if (remaining <= 3) break

      // Medium, human-like movement: small continuous steps with mild variation.
      const wave = Math.sin(performance.now() / 520) * 0.8
      const slowdown = remaining < 280 ? Math.max(1.2, remaining / 90) : 1
      const delta = Math.min(remaining, Math.max(2.4, 4.2 + wave) * slowdown)

      root.scrollBy(0, delta)
      totalDistance += delta

      const currentY = root.scrollTop
      if (Math.abs(currentY - lastY) < 0.5) {
        stillFrames += 1
      } else {
        stillFrames = 0
      }
      lastY = currentY

      if (stillFrames > 24) break
      await sleep(16 + Math.floor(Math.random() * 10))
    }

    await sleep(1400)
    return {
      reachedEnd: maxScroll() - root.scrollTop <= 4,
      distance: Math.round(totalDistance),
    }
  })
}

export const generateDueProofs = async () => {
  const nowMs = Date.now()
  const apps = localDb.prepare('SELECT * FROM apps').all()

  const dueApps = apps.filter((appData) => {
    const targetDateMs = appData.targetDate ? new Date(appData.targetDate).getTime() : null
    const stopCheckingMs = appData.stopCheckingAfter ? new Date(appData.stopCheckingAfter).getTime() : null
    if (!targetDateMs || !stopCheckingMs || Number.isNaN(stopCheckingMs)) return false
    if (nowMs < stopCheckingMs) return false

    const finalDay = Math.max(1, Math.round((stopCheckingMs - targetDateMs) / (1000 * 60 * 60 * 24)))
    const existingFinalProof = localDb
      .prepare('SELECT id FROM proofs WHERE appId = ? AND day = ? LIMIT 1')
      .get(appData.id, `Day ${finalDay}`)
    if (existingFinalProof) return false

    appData._dueDay = finalDay
    return true
  })

  const generated = []
  for (const appData of dueApps) {
    try {
      const result = await generateProofForApp(appData, appData._dueDay)
      generated.push(result)
    } catch (error) {
      console.error(`Failed to generate proof for ${appData.id}:`, error.message)
    }
  }
  return generated
}

export const generateProofForApp = async (appData, targetDay = 7, options = {}) => {
  await ensureTempDir()
  const appId = appData.id
  const now = Date.now()
  const configuredProofTimestamp = appData.stopCheckingAfter ? new Date(appData.stopCheckingAfter).getTime() : null
  const proofTimestamp =
    configuredProofTimestamp && !Number.isNaN(configuredProofTimestamp) ? configuredProofTimestamp : now
  const webmPath = path.join(TEMP_DIR, `${appId}-day${targetDay}-${now}.webm`)
  const mp4Path = path.join(TEMP_DIR, `${appId}-day${targetDay}-${now}.mp4`)

  let dateFolderName = new Date(proofTimestamp).toISOString().slice(0, 10)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })
  const viewW = 1920
  const viewH = 1080
  let context = await browser.newContext({
    viewport: { width: viewW, height: viewH },
    deviceScaleFactor: 2,
    recordVideo: {
      dir: TEMP_DIR,
      size: { width: 1920, height: 1080 },
    },
  })

  const owner = appData.ownerUserId ? findUserById(appData.ownerUserId) : null
  if (owner) {
    const sessionToken = createSessionToken(owner)
    await context.addInitScript((token) => {
      try {
        localStorage.setItem('rw_session_token', token)
      } catch {
        /* ignore */
      }
    }, sessionToken)
  } else {
    console.warn(
      `Proof record: app ${appId} has no ownerUserId; /record may not load reviews without a session.`,
    )
  }

  let page
  try {
    page = await context.newPage()
    await page.goto(getRecordUrl(appId), { waitUntil: 'networkidle' })
    await waitForRecordPageReady(page)
    const scrollResult = await smoothHumanScrollToEnd(page)
    console.log(`[proof] Smooth scroll finished: ${JSON.stringify(scrollResult)}`)

    await wait(1000)
    const video = page.video()
    await page.close()
    await context.close()
    context = null
    const videoPath = await video.path()

    await fs.copyFile(videoPath, webmPath)
    await convertWebmToMp4(webmPath, mp4Path)

    const previewPath = path.join(TEMP_DIR, 'latest-proof-preview.mp4')
    await fs.copyFile(mp4Path, previewPath)
    console.log(`[proof] Local preview (open this file): ${previewPath}`)

    if (options.localOnly) {
      await fs.rm(webmPath, { force: true })
      return {
        appId,
        day: targetDay,
        localPath: mp4Path,
        previewPath,
        localOnly: true,
      }
    }

    const ownerUserId = appData.ownerUserId ?? null

    const { auth: driveAuth } = getDriveAuth()
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    const driveReady =
      Boolean(rootFolderId) &&
      Boolean(driveAuth)

    if (!driveReady) {
      console.warn(
        'Drive upload skipped (set GOOGLE_DRIVE_FOLDER_ID + GOOGLE_SERVICE_ACCOUNT_JSON). MP4 kept locally.',
      )
      const appRow = localDb.prepare('SELECT clientId FROM apps WHERE id = ?').get(appId)
      const resolvedClientId = appData.clientId ?? appRow?.clientId ?? null
      const proofId = crypto.randomUUID()
      const videoUrl = createProofVideoUrl(proofId)
      createProofLocal({
        id: proofId,
        appId,
        ownerUserId,
        clientId: resolvedClientId,
        appName: appData.name ?? appData.packageId,
        videoUrl,
        downloadUrl: videoUrl,
        storagePath: mp4Path,
        driveFileId: null,
        day: `Day ${targetDay}`,
        date: new Date(proofTimestamp).toISOString().slice(0, 10),
        status: 'LOCAL_READY',
        createdAt: new Date().toISOString(),
      })
      updateAppLocal(appId, {
        proofStatus: 'LOCAL_READY',
        proofWebViewLink: videoUrl,
      })
      await fs.rm(webmPath, { force: true })
      return {
        appId,
        day: targetDay,
        localPath: mp4Path,
        previewPath,
      }
    }

    try {
      const client = localDb.prepare('SELECT * FROM clients WHERE id = ?').get(appData.clientId)
      let clientFolderId = client?.driveFolderId

      if (!clientFolderId) {
        const clientName = (client?.name || 'General').replace(/[^a-zA-Z0-9._-]/g, '_')
        let parentFolderId = rootFolderId
        if (owner && owner.driveFolderId) {
          parentFolderId = owner.driveFolderId
        }
        clientFolderId = await ensureSubFolder({
          parentFolderId,
          folderName: clientName,
        })
        if (client) {
          localDb.prepare('UPDATE clients SET driveFolderId = ? WHERE id = ?').run(clientFolderId, client.id)
        }
      }

      // 2. Date format DD-MM-YY
      const d = new Date(proofTimestamp)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = String(d.getFullYear()).slice(-2)
      dateFolderName = `${day}-${month}-${year}`

      const appFolderName = (appData.name ?? appData.packageId ?? appId).replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      )

      // STRUCTURE: GOOGLE_DRIVE_FOLDER_ID -> ClientName -> Date -> AppName
      const dateFolderId = await ensureSubFolder({
        parentFolderId: clientFolderId,
        folderName: dateFolderName,
      })

      const appFolderId = await ensureSubFolder({
        parentFolderId: dateFolderId,
        folderName: appFolderName,
      })

      const driveUpload = await uploadVideoToDriveFolder({
        filePath: mp4Path,
        appId,
        timestamp: proofTimestamp,
        parentFolderId: appFolderId,
      })

      const appRow = localDb.prepare('SELECT clientId FROM apps WHERE id = ?').get(appId)
      const resolvedClientId = appData.clientId ?? appRow?.clientId ?? null

      const proofData = {
        id: crypto.randomUUID(),
        appId,
        ownerUserId,
        clientId: resolvedClientId,
        appName: appData.name ?? appData.packageId,
        videoUrl: driveUpload.webViewLink,
        downloadUrl: driveUpload.webContentLink,
        storagePath: driveUpload.drivePath,
        driveFileId: driveUpload.fileId,
        day: `Day ${targetDay}`,
        date: dateFolderName,
        status: 'READY',
        createdAt: new Date().toISOString(),
      }

      createProofLocal(proofData)

      updateAppLocal(appId, {
        proofStatus: 'READY',
        proofWebViewLink: driveUpload.webViewLink,
      })

      await fs.rm(webmPath, { force: true })
      await fs.rm(mp4Path, { force: true })
      return {
        appId,
        day: targetDay,
        videoUrl: driveUpload.webViewLink,
        previewPath,
      }
    } catch (driveErr) {
      console.warn('[proof] Drive upload failed; MP4 kept locally:', driveErr.message)
      const appRow = localDb.prepare('SELECT clientId FROM apps WHERE id = ?').get(appId)
      const resolvedClientId = appData.clientId ?? appRow?.clientId ?? null
      const proofId = crypto.randomUUID()
      const videoUrl = createProofVideoUrl(proofId)
      createProofLocal({
        id: proofId,
        appId,
        ownerUserId,
        clientId: resolvedClientId,
        appName: appData.name ?? appData.packageId,
        videoUrl,
        downloadUrl: videoUrl,
        storagePath: mp4Path,
        driveFileId: null,
        day: `Day ${targetDay}`,
        date: dateFolderName,
        status: 'LOCAL_READY',
        createdAt: new Date().toISOString(),
      })
      updateAppLocal(appId, {
        proofStatus: 'LOCAL_READY',
        proofWebViewLink: videoUrl,
      })
      await fs.rm(webmPath, { force: true })
      return {
        appId,
        day: targetDay,
        localPath: mp4Path,
        previewPath,
        uploadError: driveErr.message,
      }
    }
  } finally {
    try {
      if (context) await context.close()
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
