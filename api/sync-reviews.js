import { syncAppReviews } from '../server/syncEngine.js'
import { readActiveUserFromRequest } from '../server/auth.js'
import { getAppLocal } from '../server/dataService.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = readActiveUserFromRequest(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized or account is not active' })
    }

    const {
      appId,
      packageId,
      targetDate,
      selectedHint = ',',
      hintMode = 'strict-hint',
      stopCheckingAfter = null,
      starRating = null,
    } = req.body

    if (!appId || !packageId || !targetDate) {
      return res.status(400).json({ error: 'appId, packageId and targetDate are required' })
    }

    // Security: Ensure user owns this app or is admin
    const appData = getAppLocal(appId)
    if (!appData) {
      return res.status(404).json({ error: 'App not found' })
    }
    
    if (user.role !== 'admin' && appData.ownerUserId !== user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this app' })
    }

    if (appData.syncProgress !== null && appData.syncProgress !== undefined) {
      return res.status(200).json({
        ok: true,
        message: 'Sync is already running for this app',
      })
    }

    // Run the sync in the background to prevent API timeout
    syncAppReviews({
      appId,
      packageId,
      targetDate,
      selectedHint,
      hintMode,
      ownerUserId: appData.ownerUserId,
      stopCheckingAfter,
      starRating,
    }).then((result) => {
      console.log(`Bg Sync complete for ${packageId}:`, result)
      const stopMs = stopCheckingAfter ? new Date(stopCheckingAfter).getTime() : null
      if (stopMs && !Number.isNaN(stopMs) && Date.now() >= stopMs) {
        import('../server/proofEngine.js')
          .then(({ generateDueProofs }) => generateDueProofs())
          .then((proofResults) => {
            console.log(`Manual sync proof generation checked for ${packageId}:`, proofResults)
          })
          .catch((proofErr) => {
            console.error(`Manual sync proof generation failed for ${packageId}:`, proofErr.message)
          })
      }
    }).catch(async (err) => {
      console.error(`Bg Sync failed for ${packageId}:`, err.message)
      // Reset progress on error
      const { updateAppLocal } = await import('../server/dataService.js')
      updateAppLocal(appId, { syncProgress: null, syncStatus: `Error: ${err.message}` }).catch(() => {})
    })

    return res.status(200).json({
      ok: true,
      message: 'Sync started in background',
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
