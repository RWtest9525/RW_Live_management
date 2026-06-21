export const isPortalAccessActive = (user) => {
  if (!user) return false
  if (user.role === 'admin' || user.accessPlan === 'lifetime') return true

  const validUntilMs = user.validUntil ? new Date(user.validUntil).getTime() : 0
  return Boolean(user.accessPlan && user.accessPlan !== 'free') &&
    !Number.isNaN(validUntilMs) &&
    validUntilMs > Date.now()
}

export const formatValidUntil = (value) => {
  if (!value) return 'Not active'
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
