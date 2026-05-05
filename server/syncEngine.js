import crypto from 'node:crypto'
import gplay from 'google-play-scraper'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebaseAdmin.js'

const normalize = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase()
const makeReviewKey = (userName, content) =>
  crypto.createHash('sha256').update(`${normalize(userName)}::${normalize(content)}`).digest('hex')

const isRepeatedSymbolTail = (value) => {
  if (value.length < 2) return false
  const lastChar = value.at(-1)
  const prevChar = value.at(-2)
  return /\W/.test(lastChar) && lastChar === prevChar
}

const endsWithSingleHint = (text, selectedHint) => {
  if (!selectedHint) return false
  if (!text.endsWith(selectedHint)) return false
  return !text.endsWith(`${selectedHint}${selectedHint}`)
}

export const matchesStrictHint = (text, selectedHint, hintMode) => {
  const normalized = String(text ?? '').trim()
  if (!normalized) return false

  if (hintMode === 'hint-wise') {
    // Exact trailing hint only; repeated symbols are rejected.
    return endsWithSingleHint(normalized, selectedHint)
  }

  // No-hint accepts single "." or trailing alphanumeric only.
  // Repeated punctuation tails like "..", ",,", "!!" are always excluded.
  if (isRepeatedSymbolTail(normalized)) return false
  const lastChar = normalized.at(-1)
  return lastChar === '.' || /[a-z0-9]/i.test(lastChar)
}

export const fetchAllReviews = async ({ packageId, targetDate }) => {
  const allReviews = []
  const targetMs = new Date(targetDate).getTime()
  let continuationToken
  let keepGoing = true

  while (keepGoing) {
    const response = await gplay.reviews({
      appId: packageId,
      sort: gplay.sort.NEWEST,
      paginate: true,
      nextPaginationToken: continuationToken,
      lang: 'en',
      country: 'in',
    })

    allReviews.push(...response.data)
    continuationToken = response.nextPaginationToken
    const crossedTarget = response.data.some(
      (review) => new Date(review.date).getTime() < targetMs,
    )

    if (!continuationToken || crossedTarget) {
      keepGoing = false
    }
  }

  return allReviews.filter((review) => new Date(review.date).getTime() >= targetMs)
}

export const syncAppReviews = async ({
  appId,
  packageId,
  targetDate,
  selectedHint = ',',
  hintMode = 'hint-wise',
  ownerUserId = null,
}) => {
  const fetchedReviews = await fetchAllReviews({ packageId, targetDate })
  const filteredReviews = fetchedReviews.filter((review) =>
    matchesStrictHint(review.text ?? '', selectedHint, hintMode),
  )

  const existingSnapshot = await adminDb
    .collection('reviews')
    .where('appId', '==', appId)
    .get()
  const existingByKey = new Map()
  existingSnapshot.forEach((doc) => {
    const data = doc.data()
    existingByKey.set(data.reviewKey, { id: doc.id, ...data })
  })

  const seenKeys = new Set()
  const batch = adminDb.batch()

  filteredReviews.forEach((review) => {
    const userName = review.userName ?? 'Unknown'
    const content = review.text ?? ''
    const reviewKey = makeReviewKey(userName, content)
    if (seenKeys.has(reviewKey)) return
    seenKeys.add(reviewKey)

    const existing = existingByKey.get(reviewKey)
    const payload = {
      appId,
      packageId,
      userName,
      content,
      rating: review.score ?? 0,
      date: review.date ? new Date(review.date) : new Date(),
      status: 'VERIFIED LIVE',
      hintCategory: hintMode === 'hint-wise' ? `HINT:${selectedHint}` : 'NO_HINT',
      ownerUserId,
      reviewKey,
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (existing) {
      batch.set(adminDb.collection('reviews').doc(existing.id), payload, { merge: true })
    } else {
      batch.set(adminDb.collection('reviews').doc(), {
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
      })
    }
  })

  for (const [reviewKey, existing] of existingByKey.entries()) {
    if (!seenKeys.has(reviewKey)) {
      batch.set(
        adminDb.collection('reviews').doc(existing.id),
        { status: 'DROPPED', updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
    }
  }

  batch.set(
    adminDb.collection('apps').doc(appId),
    {
      packageId,
      selectedHint,
      ownerUserId,
      lastSyncedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  await batch.commit()

  return {
    totalFetched: fetchedReviews.length,
    acceptedAfterFilter: filteredReviews.length,
    droppedCount: [...existingByKey.keys()].filter((key) => !seenKeys.has(key)).length,
  }
}

export const syncAllActiveApps = async () => {
  const appSnapshot = await adminDb
    .collection('apps')
    .where('monitoringStatus', '==', 'ACTIVE')
    .get()

  const results = []
  for (const appDoc of appSnapshot.docs) {
    const appData = appDoc.data()
    const targetDate =
      appData.targetDate ??
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const result = await syncAppReviews({
      appId: appDoc.id,
      packageId: appData.packageId,
      targetDate,
      selectedHint: appData.selectedHint ?? ',',
      hintMode: appData.hintMode ?? 'hint-wise',
      ownerUserId: appData.ownerUserId ?? null,
    })
    results.push({ appId: appDoc.id, appName: appData.name ?? appData.packageId, ...result })
  }
  return results
}
