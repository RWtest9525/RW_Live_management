import axios from 'axios'
import localDb from '../server/localDb.js'

const webhookUrl = process.env.DAILY_REPORT_WEBHOOK_URL
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
const telegramChatId = process.env.TELEGRAM_CHAT_ID

const buildDailySummary = async () => {
  try {
    const apps = localDb.prepare('SELECT count(*) as count FROM apps').get()
    const reviews = localDb.prepare('SELECT count(*) as count FROM reviews WHERE status = "VERIFIED LIVE"').get()
    const drops = localDb.prepare('SELECT count(*) as count FROM reviews WHERE status = "DROPPED"').get()
    const proofs = localDb.prepare('SELECT count(*) as count FROM proofs WHERE createdAt >= ?').get(new Date().toDateString())

    return {
      totalApps: apps?.count || 0,
      totalLive: reviews?.count || 0,
      totalDrops: drops?.count || 0,
      videosGenerated: proofs?.count || 0,
    }
  } catch (err) {
    console.error('Error building summary from localDb:', err.message)
    return {
      totalApps: 0,
      totalLive: 0,
      totalDrops: 0,
      videosGenerated: 0,
    }
  }
}

const sendDailyReport = async (summary) => {
  const text = `Review World Daily Report\n\nTotal apps monitored today: ${summary.totalApps}.\nTotal Live: ${summary.totalLive}.\nDrops: ${summary.totalDrops}.\nVideos Generated: ${summary.videosGenerated}.`
  let delivered = false

  console.log('Attempting to send daily report...')
  console.log(`Telegram Token exists: ${!!telegramBotToken}`)
  console.log(`Telegram Chat ID: ${telegramChatId}`)

  if (telegramBotToken && telegramChatId) {
    try {
      const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
      const response = await axios.post(telegramUrl, {
        chat_id: telegramChatId,
        text: text,
      })
      console.log('Telegram response:', response.data)
      delivered = true
    } catch (error) {
      console.error('Telegram send failed:', error.response?.data || error.message)
    }
  }

  if (webhookUrl) {
    try {
      await axios.post(webhookUrl, { text, summary, primary: 'telegram' })
      delivered = true
    } catch (error) {
      console.error('Webhook send failed:', error.message)
    }
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
