import { getStoredToken } from './authApi'

export const triggerSyncForApp = async ({
  appId,
  packageId,
  targetDate,
  selectedHint,
  hintMode,
  stopCheckingAfter,
  starRating,
}) => {
  const token = getStoredToken()
  const response = await fetch('/api/sync-reviews', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      appId,
      packageId,
      targetDate,
      selectedHint,
      hintMode,
      stopCheckingAfter,
      starRating,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Sync failed')
  }

  return response.json()
}
