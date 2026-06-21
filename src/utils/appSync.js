/** True while a background review sync is updating this app (for UI polling). */
export function isAppSyncInProgress(app) {
  if (!app) return false
  const p = app.syncProgress
  if (p !== null && p !== undefined && p !== '') return true
  const s = String(app.syncStatus || '').trim()
  if (!s) return false
  return /^(Starting|Fetching|Scraping|Filtering|Saving|Finalizing|Matching|Writing)/i.test(s)
}

export function shouldPollAppsForSync(apps) {
  if (!Array.isArray(apps)) return false
  return apps.some(isAppSyncInProgress)
}
