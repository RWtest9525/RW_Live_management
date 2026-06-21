import { syncAllActiveApps } from '../server/syncEngine.js'
import { generateDueProofs } from '../server/proofEngine.js'
import { readAuthUserFromRequest } from '../server/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await readAuthUserFromRequest(req)
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ error: 'Admin access required' })
    }

    const syncResults = await syncAllActiveApps()
    const proofResults = await generateDueProofs()

    return res.status(200).json({
      ok: true,
      syncResults,
      proofResults,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
