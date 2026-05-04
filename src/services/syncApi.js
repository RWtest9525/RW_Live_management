export const triggerSyncForApp = async ({
  appId,
  packageId,
  targetDate,
  selectedHint,
  hintMode,
}) => {
  const response = await fetch('/api/sync-reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId,
      packageId,
      targetDate,
      selectedHint,
      hintMode,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Sync failed')
  }

  return response.json()
}
