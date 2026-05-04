import cron from 'node-cron'
import axios from 'axios'
import { adminDb } from '../server/firebaseAdmin.js'
import { generateDueProofs } from '../server/proofEngine.js'
import { syncAllActiveApps } from '../server/syncEngine.js'

const webhookUrl = process.env.DAILY_REPORT_WEBHOOK_URL
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
const telegramChatId = process.env.TELEGRAM_CHAT_ID

const buildDailySummary = async () => {
  const [appsSnapshot, reviewsSnapshot, proofsSnapshot] = await Promise.all([
    adminDb.collection('apps').get(),
    adminDb.collection('reviews').get(),
    adminDb.collection('proofs').get(),
  ])
  const totalApps = appsSnapshot.size
  const totalLive = reviewsSnapshot.docs.filter(
    (doc) => doc.data().status === 'VERIFIED LIVE',
  ).length
  const totalDrops = reviewsSnapshot.docs.filter(
    (doc) => doc.data().status === 'DROPPED',
  ).length

  const todayKey = new Date().toDateString()
  const videosGenerated = proofsSnapshot.docs.filter((doc) => {
    const date = doc.data().createdAt?.toDate?.()
    if (!date) return false
    return date.toDateString() === todayKey
  }).length

  return {
    totalApps,
    totalLive,
    totalDrops,
    videosGenerated,
  }
}

const sendDailyReport = async (summary) => {
  const text = `Total apps monitored today: ${summary.totalApps}. Total Live: ${summary.totalLive}. Drops: ${summary.totalDrops}. Videos Generated: ${summary.videosGenerated}.`
  let delivered = false

  if (telegramBotToken && telegramChatId) {
    const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
    await axios.post(telegramUrl, {
      chat_id: telegramChatId,
      text: `Review World Daily Report\n\n${text}`,
    })
    delivered = true
  }

  if (webhookUrl) {
    await axios.post(webhookUrl, { text, summary, primary: 'telegram' })
    delivered = true
  }

  if (!delivered) {
    console.warn(
      'No daily report destination configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.',
    )
  }
}

const runHourlyAutomation = async () => {
  const syncResults = await syncAllActiveApps()
  const proofResults = await generateDueProofs()
  return { syncResults, proofResults }
}

const runDailyReport = async () => {
  const summary = await buildDailySummary()
  await sendDailyReport(summary)
  return summary
}

export const startAutomationWorker = () => {
  cron.schedule('0 * * * *', async () => {
    await runHourlyAutomation()
  })

  cron.schedule('0 0 * * *', async () => {
    const summary = await buildDailySummary()
    await sendDailyReport(summary)
  })
}

if (process.argv.includes('--run-once')) {
  runHourlyAutomation()
    .then(({ syncResults, proofResults }) => {
      console.log('Hourly automation complete', {
        syncedApps: syncResults.length,
        generatedProofs: proofResults.length,
      })
      return runDailyReport()
    })
    .then((summary) => console.log('Daily summary', summary))
    .catch((error) => {
      console.error('Automation failed', error)
      process.exitCode = 1
    })
} else {
  startAutomationWorker()
  console.log('Automation worker started.')
}
