import fs from 'node:fs'
import path from 'node:path'
import { getSubscriptionPlan, isUnlimited } from '../shared/subscriptionPlans.js'
import localDb from './localDb.js'

const GB = 1024 * 1024 * 1024

export const getUserPlan = (user) => {
  if (user?.role === 'admin' || user?.accessPlan === 'lifetime') {
    return {
      id: 'lifetime',
      name: 'Admin Lifetime',
      priceInr: 0,
      durationDays: null,
      listLimit: null,
      storageGb: null,
      benefits: ['Unlimited admin access'],
    }
  }

  return getSubscriptionPlan(user?.accessPlan) ?? null
}

export const isUserAccessActive = (user) => {
  if (!user) return false
  if (user.role === 'admin' || user.accessPlan === 'lifetime') return true

  const validUntil = user.validUntil ? new Date(user.validUntil).getTime() : 0
  return Boolean(getUserPlan(user)) && !Number.isNaN(validUntil) && validUntil > Date.now()
}

export const getUserUsage = (userId) => {
  const listCount =
    localDb.prepare('SELECT COUNT(*) AS count FROM apps WHERE ownerUserId = ?').get(userId)
      ?.count ?? 0

  const proofRows = localDb
    .prepare('SELECT storagePath FROM proofs WHERE ownerUserId = ?')
    .all(userId)

  let storageBytes = 0
  for (const proof of proofRows) {
    if (!proof.storagePath || /^https?:\/\//i.test(proof.storagePath)) continue
    try {
      const filePath = path.resolve(proof.storagePath)
      if (fs.existsSync(filePath)) {
        storageBytes += fs.statSync(filePath).size
      }
    } catch {
      // Storage usage is best-effort for local proof files.
    }
  }

  return {
    listCount,
    storageBytes,
    storageGbUsed: Number((storageBytes / GB).toFixed(3)),
  }
}

export const getSubscriptionSummary = (user) => {
  const plan = getUserPlan(user)
  const usage = user?.id ? getUserUsage(user.id) : { listCount: 0, storageBytes: 0, storageGbUsed: 0 }
  const active = isUserAccessActive(user)
  const listRemaining =
    plan && !isUnlimited(plan.listLimit)
      ? Math.max(0, Number(plan.listLimit) - usage.listCount)
      : null
  const storageRemainingGb =
    plan && !isUnlimited(plan.storageGb)
      ? Math.max(0, Number((Number(plan.storageGb) - usage.storageGbUsed).toFixed(3)))
      : null

  return {
    active,
    plan,
    validUntil: user?.validUntil ?? null,
    usage,
    limits: {
      listLimit: plan?.listLimit ?? null,
      storageGb: plan?.storageGb ?? null,
      listRemaining,
      storageRemainingGb,
    },
  }
}

export const assertCanCreateApp = (user) => {
  if (user.role === 'admin') return

  const summary = getSubscriptionSummary(user)
  if (!summary.active) {
    const error = new Error('Your plan is expired or inactive. Please buy a plan to add apps.')
    error.statusCode = 402
    throw error
  }

  if (!isUnlimited(summary.plan?.listLimit) && summary.usage.listCount >= summary.plan.listLimit) {
    const error = new Error(`Your ${summary.plan.name} plan allows ${summary.plan.listLimit} list entries. Upgrade to add more apps.`)
    error.statusCode = 402
    throw error
  }
}

export const getNextValidUntil = (user, plan) => {
  const currentExpiry = user?.validUntil ? new Date(user.validUntil).getTime() : 0
  const baseMs = currentExpiry > Date.now() ? currentExpiry : Date.now()
  return new Date(baseMs + plan.durationDays * 24 * 60 * 60 * 1000).toISOString()
}

export const getValidUntilForPlan = (planId, user = null) => {
  if (!planId || planId === 'free') return null
  if (planId === 'lifetime') return null

  const plan = getSubscriptionPlan(planId)
  if (!plan) return null
  return getNextValidUntil(user, plan)
}

export const planAllowsTelegramNotifications = (user) => {
  if (user?.role === 'admin') return true
  const plan = getUserPlan(user)
  return Boolean(plan?.telegramNotifications)
}
