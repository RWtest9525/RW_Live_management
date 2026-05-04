import { syncAppReviews } from '../server/syncEngine.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { appId, packageId, targetDate, selectedHint = ',', hintMode = 'hint-wise' } = req.body

    if (!appId || !packageId || !targetDate) {
      return res.status(400).json({ error: 'appId, packageId and targetDate are required' })
    }

    const result = await syncAppReviews({
      appId,
      packageId,
      targetDate,
      selectedHint,
      hintMode,
    })

    return res.status(200).json({
      ok: true,
      ...result,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
