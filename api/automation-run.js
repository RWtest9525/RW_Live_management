import { generateDueProofs } from '../server/proofEngine.js'
import { syncAllActiveApps } from '../server/syncEngine.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const syncResults = await syncAllActiveApps()
    const proofResults = await generateDueProofs()
    return res.status(200).json({
      ok: true,
      syncedApps: syncResults.length,
      generatedProofs: proofResults.length,
      syncResults,
      proofResults,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
