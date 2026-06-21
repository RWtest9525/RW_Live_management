import 'dotenv/config'
import cron from 'node-cron'
import { syncAllActiveApps } from '../server/syncEngine.js'
import { generateDueProofs } from '../server/proofEngine.js'
import localDb from '../server/localDb.js'
import { findUserById } from '../server/userStore.js'
import { planAllowsTelegramNotifications } from '../server/subscription.js'
import { createExcelDownloadToken } from '../server/auth.js'
import { buildReviewExcelBuffer, getVerifiedReviewsForAppDate } from '../server/excelReport.js'
import { uploadBufferToDriveFolder } from '../server/driveStorage.js'

const webhookUrl = process.env.DAILY_REPORT_WEBHOOK_URL
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
const telegramChatId = process.env.TELEGRAM_CHAT_ID

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const absoluteUrl = (value, baseUrl) => {
  if (!value) return ''
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return value
  }
}

const getAppFinalTime = (appData) => {
  if (appData?.stopCheckingAfter) {
    const parsed = new Date(appData.stopCheckingAfter)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  if (appData?.listDate && appData?.listTime) {
    const parsed = new Date(`${appData.listDate}T${appData.listTime}:00+05:30`)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  if (appData?.targetDate) {
    const parsed = new Date(appData.targetDate)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return null
}

const getIstDayUtcWindow = (dateKey) => {
  if (!dateKey) return null
  const parsed = new Date(`${dateKey}T00:00:00+05:30`)
  if (Number.isNaN(parsed.getTime())) return null
  return {
    startIso: parsed.toISOString(),
    endIso: new Date(parsed.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

const getProofFolderId = (proof) => {
  const firstPathPart = String(proof?.storagePath || '').split('/').filter(Boolean)[0]
  return firstPathPart || ''
}

const buildTelegramExcelLink = async ({ appData, reportDate, fallbackUrl }) => {
  try {
    const parentFolderId = appData.driveFolderId
    if (!parentFolderId) {
      console.warn(`[telegram] driveFolderId not set for app ${appData.id}`)
      return fallbackUrl
    }
    const reviews = getVerifiedReviewsForAppDate({ appId: appData.id, date: reportDate })
    const { buffer, fileName } = buildReviewExcelBuffer({
      reviews,
      fileName: `${appData.name || appData.packageId}_${reportDate || 'Report'}_Live.xlsx`,
    })
    const uploaded = await uploadBufferToDriveFolder({
      buffer,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      parentFolderId,
    })
    return uploaded.webViewLink || uploaded.webContentLink || fallbackUrl
  } catch (error) {
    console.warn(`[telegram] Drive Excel upload failed for ${appData.id}:`, error.message)
    return fallbackUrl
  }
}

const sendTelegramMessage = async ({ botToken, chatId, message }) => {
  if (!botToken || !chatId) return false

  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `Telegram returned ${response.status}`)
    }
    return true
  } catch (err) {
    console.error('Telegram alert failed:', err.message)
    return false
  }
}

const buildDailySummary = async () => {
  try {
    const apps = localDb.prepare('SELECT count(*) as count FROM apps').get()
    const reviews = localDb.prepare("SELECT count(*) as count FROM reviews WHERE status = 'VERIFIED LIVE'").get()
    const drops = localDb.prepare("SELECT count(*) as count FROM reviews WHERE status = 'DROPPED'").get()
    const proofs = localDb.prepare('SELECT count(*) as count FROM proofs WHERE createdAt >= ?').get(new Date().toDateString())

    return {
      totalApps: apps?.count || 0,
      totalLive: reviews?.count || 0,
      totalDrops: drops?.count || 0,
      videosGenerated: proofs?.count || 0,
      message: 'Automation summary from local database',
    }
  } catch (err) {
    console.error('Error building summary:', err.message)
    return {
      totalApps: 0,
      totalLive: 0,
      totalDrops: 0,
      videosGenerated: 0,
      message: `Error building summary: ${err.message}`,
    }
  }
}

const sendDailyReport = async (summary) => {
  const text = `Review World Daily Report\n\nTotal Apps: ${summary.totalApps}\nTotal Live: ${summary.totalLive}\nDrops: ${summary.totalDrops}\nVideos: ${summary.videosGenerated}\n\n${summary.message}`

  await sendTelegramMessage({
    botToken: telegramBotToken,
    chatId: telegramChatId,
    message: escapeHtml(text),
  })

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, summary }),
      })
    } catch (err) {
      console.error('Webhook failed:', err.message)
    }
  }
}

export const sendTelegramAlert = async (message) => {
  await sendTelegramMessage({
    botToken: telegramBotToken,
    chatId: telegramChatId,
    message: escapeHtml(message),
  })
}

export const notifyAppSyncComplete = async (appData, result = {}) => {
  const owner = appData.ownerUserId ? findUserById(appData.ownerUserId) : null
  if (!owner || !planAllowsTelegramNotifications(owner)) return

  const finalTime = getAppFinalTime(appData)
  if (!finalTime || finalTime.getTime() > Date.now()) return

  const notifyKey = `${appData.id}:${finalTime.toISOString()}`
  if (appData.telegramNotifiedKey === notifyKey) return

  const ownerBotToken = owner.telegramBotToken?.trim() || (owner.role === 'admin' ? telegramBotToken : '')
  const ownerChatId = owner.telegramChatId?.trim() || (owner.role === 'admin' ? telegramChatId : '')
  if (!ownerBotToken || !ownerChatId) {
    console.warn(`[telegram] Missing personal bot token/chat ID for ${owner.email}. Final list notification skipped.`)
    return
  }

  const portalBaseUrl = process.env.PORTAL_BASE_URL || 'http://localhost:5173'
  const reportDate = appData.listDate || appData.targetDate?.split('T')[0] || ''
  const excelUrl = new URL('/api/download-excel', portalBaseUrl)
  excelUrl.searchParams.set('appId', appData.id)
  if (reportDate) excelUrl.searchParams.set('date', reportDate)
  excelUrl.searchParams.set('token', createExcelDownloadToken(appData.id, reportDate))

  const latestProof = localDb.prepare('SELECT videoUrl FROM proofs WHERE appId = ? ORDER BY createdAt DESC LIMIT 1').get(appData.id)
  const proofLink = latestProof?.videoUrl ? absoluteUrl(latestProof.videoUrl, portalBaseUrl) : ''

  let liveCount = Number(result.acceptedAfterFilter || 0)
  let droppedCount = Number(result.droppedCount || 0)
  const dateWindow = getIstDayUtcWindow(reportDate)
  if (dateWindow) {
    liveCount =
      localDb
        .prepare("SELECT COUNT(*) AS count FROM reviews WHERE appId = ? AND status = 'VERIFIED LIVE' AND date >= ? AND date < ?")
        .get(appData.id, dateWindow.startIso, dateWindow.endIso)?.count || 0
    droppedCount =
      localDb
        .prepare("SELECT COUNT(*) AS count FROM reviews WHERE appId = ? AND status = 'DROPPED' AND date >= ? AND date < ?")
        .get(appData.id, dateWindow.startIso, dateWindow.endIso)?.count || droppedCount
  }

  const rate = Number(appData.ratePerReview || 0)
  const amount = liveCount * rate
  const hintLabel = appData.hintMode === 'no-hint' ? 'No Hint' : appData.selectedHint || 'Show All'
  const excelLink = await buildTelegramExcelLink({
    appData,
    reportDate,
    fallbackUrl: excelUrl.toString(),
  })

  const reportLinks = [
    `<a href="${escapeHtml(excelLink)}">Excel</a>`,
    proofLink ? `<a href="${escapeHtml(proofLink)}">Open Video</a>` : '<i>Video pending</i>',
  ].join(' | ')

  const message = [
    '<b>RW Report Ready</b>',
    `<b>${escapeHtml(appData.name)}</b>`,
    `Date: ${escapeHtml(reportDate || 'N/A')} | Hint: ${escapeHtml(hintLabel)}`,
    `Live: <b>${liveCount}</b> | Dropped: <b>${droppedCount}</b>`,
    `Amount: <b>Rs ${amount}</b> (${liveCount} x Rs ${rate})`,
    reportLinks,
  ].join('\n')

  localDb
    .prepare('UPDATE apps SET telegramNotifiedAt = ?, telegramNotifiedKey = ? WHERE id = ?')
    .run(new Date().toISOString(), notifyKey, appData.id)

  const sent = await sendTelegramMessage({ botToken: ownerBotToken, chatId: ownerChatId, message })
  if (!sent) {
    console.warn(`[telegram] Failed to send final list Telegram message for app ${appData.id}`)
  }
}

const notifyDueFinalLists = async () => {
  const apps = localDb
    .prepare("SELECT * FROM apps WHERE monitoringStatus = 'ACTIVE'")
    .all()

  for (const app of apps) {
    try {
      await notifyAppSyncComplete(app)
    } catch (err) {
      console.error(`Final Telegram notification failed for ${app.id}:`, err.message)
    }
  }
}

let scheduledRunInProgress = false

const runScheduledAutomation = async (source = 'scheduled') => {
  if (scheduledRunInProgress) {
    console.log(`[automation] ${source} skipped because previous automation run is still active.`)
    return { skipped: 'Automation already running' }
  }

  scheduledRunInProgress = true
  console.log(`Running scheduled automation (${source}: Local Sync & Proof Generation)...`)
  try {
    const syncResults = await syncAllActiveApps()
    const proofResults = await generateDueProofs()
    await notifyDueFinalLists()
    const summary = await buildDailySummary()
    console.log('Automation summary:', summary)
    return { syncResults, proofResults, summary }
  } catch (error) {
    console.error('Scheduled automation failed:', error.message)
    await sendTelegramAlert(`Scheduled automation failed: ${error.message}`)
    return { error: error.message }
  } finally {
    scheduledRunInProgress = false
  }
}

const runDailyReport = async () => {
  console.log('Running daily report...')
  try {
    const summary = await buildDailySummary()
    await sendDailyReport(summary)
    return summary
  } catch (error) {
    console.error('Daily report failed:', error.message)
    await sendTelegramAlert(`Daily report failed: ${error.message}`)
    return { error: error.message }
  }
}

let isStarted = false

export const startAutomationWorker = () => {
  if (isStarted) {
    console.log('Automation worker already running, skipping start.')
    return
  }
  isStarted = true
  console.log('Starting automation worker...')

  setTimeout(() => {
    runScheduledAutomation('startup').catch((err) => {
      console.error('Startup automation run failed:', err.message)
    })
  }, 5000)

  cron.schedule('* * * * *', async () => {
    console.log('--- Scheduled Automation Run (1 min due-check) ---')
    try {
      await runScheduledAutomation('minute-cron')
    } catch (err) {
      console.error('CRITICAL: Cron job runScheduledAutomation failed:', err.message)
    }
  })

  cron.schedule('0 0 * * *', async () => {
    console.log('--- Scheduled Daily Report ---')
    try {
      await runDailyReport()
    } catch (err) {
      console.error('CRITICAL: Cron job runDailyReport failed:', err.message)
    }
  })

  console.log('Automation worker started. Cron jobs scheduled.')
}

const isMainModule = process.argv[1] && process.argv[1].endsWith('automationWorker.js')
if (isMainModule || process.argv.includes('--run-once')) {
  if (process.argv.includes('--run-once')) {
    runScheduledAutomation('manual-once')
      .then(({ syncResults, proofResults }) => {
        console.log('Scheduled automation complete', { syncResults, proofResults })
        return runDailyReport()
      })
      .then((summary) => console.log('Daily summary', summary))
      .catch((error) => {
        console.error('Automation failed', error)
        process.exitCode = 1
      })
  } else {
    startAutomationWorker()
  }
}
