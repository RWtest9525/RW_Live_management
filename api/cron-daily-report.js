import axios from 'axios'
import { adminDb } from '../server/firebaseAdmin.js'

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

  return delivered
}

export default async function handler(req, res) {
  // Security check for cron
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const summary = await buildDailySummary()
    const delivered = await sendDailyReport(summary)
    return res.status(200).json({
      ok: true,
      summary,
      delivered,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
