import crypto from 'node:crypto'
import gplay from 'google-play-scraper'
import localDb from './localDb.js'
import { updateAppLocal } from './dataService.js'
import {
  getHintCategoryLabel,
  matchesReviewByHintMode,
} from '../shared/reviewHints.js'

const normalize = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase()
const makeReviewKey = (userName, content) =>
  crypto.createHash('sha256').update(`${normalize(userName)}::${normalize(content)}`).digest('hex')

const IST_OFFSET_MINUTES = 330
const DAY_MS = 24 * 60 * 60 * 1000
const PLAY_STORE_PAGE_SIZE = 150
const MAX_REVIEW_PAGES = 2000
const MAX_RAW_REVIEWS = 200000

let lastScrapeStatusWrite = 0

const toIstDateKey = (value) => {
  const ms = new Date(value).getTime()
  if (Number.isNaN(ms)) return ''
  return new Date(ms + IST_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10)
}

const getIstDayWindowForSync = (targetDate) => {
  const targetMs = new Date(targetDate).getTime()
  if (Number.isNaN(targetMs)) {
    return { dayNumber: 0, windowStartMs: NaN, windowEndMs: NaN }
  }

  // Convert both timestamps to IST timeline and snap to IST day boundaries.
  const nowIstMs = Date.now() + IST_OFFSET_MINUTES * 60 * 1000
  const targetIstMs = targetMs + IST_OFFSET_MINUTES * 60 * 1000

  const nowIstDayStart = Math.floor(nowIstMs / DAY_MS) * DAY_MS
  const targetIstDayStart = Math.floor(targetIstMs / DAY_MS) * DAY_MS
  const dayNumber = Math.max(0, Math.floor((nowIstDayStart - targetIstDayStart) / DAY_MS))

  // Convert IST day window back to UTC epoch milliseconds.
  const windowStartMs = targetIstDayStart + dayNumber * DAY_MS - IST_OFFSET_MINUTES * 60 * 1000
  const windowEndMs = windowStartMs + DAY_MS
  return { dayNumber, windowStartMs, windowEndMs }
}

/** Single IST calendar day that contains `targetDate` (India), as UTC [startMs, endMs). */
const getIstListingDayUtcWindow = (targetDate) => {
  const targetMs = new Date(targetDate).getTime()
  if (Number.isNaN(targetMs)) {
    return { startMs: NaN, endMs: NaN, startIso: '', endIso: '' }
  }
  const targetIstMs = targetMs + IST_OFFSET_MINUTES * 60 * 1000
  const istDayStart = Math.floor(targetIstMs / DAY_MS) * DAY_MS
  const startMs = istDayStart - IST_OFFSET_MINUTES * 60 * 1000
  const endMs = startMs + DAY_MS
  return {
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  }
}

export const fetchAllReviews = async ({ appId, packageId, targetDate }) => {
  const allReviews = []
  const { startMs, endMs, startIso, endIso } = getIstListingDayUtcWindow(targetDate)
  const targetIstDateKey = toIstDateKey(targetDate)
  if (Number.isNaN(startMs)) {
    console.warn(`Invalid targetDate for scrape: ${targetDate}`)
    return []
  }

  lastScrapeStatusWrite = 0

  let continuationToken
  let keepGoing = true
  let pageCount = 0

  console.log(
    `Starting scrape for ${packageId}, target IST date ${targetIstDateKey}, UTC window [${startIso} .. ${endIso})`,
  )

  while (keepGoing) {
    try {
      const response = await gplay.reviews({
        appId: packageId,
        sort: gplay.sort.NEWEST,
        paginate: true,
        nextPaginationToken: continuationToken,
        lang: 'en',
        country: 'in',
        num: PLAY_STORE_PAGE_SIZE
      })

      if (!response.data || response.data.length === 0) {
        break
      }

      allReviews.push(...response.data)
      continuationToken = response.nextPaginationToken
      pageCount++
      
      const oldestInBatchDateKey = toIstDateKey(response.data[response.data.length - 1].date)

      if (oldestInBatchDateKey && oldestInBatchDateKey < targetIstDateKey) {
        console.log(
          `Reached reviews older than target IST date (${targetIstDateKey}) at page ${pageCount}`,
        )
        keepGoing = false
      }

      if (appId) {
        const now = Date.now()
        if (now - lastScrapeStatusWrite > 900) {
          lastScrapeStatusWrite = now
          updateAppLocal(appId, {
            syncProgress: -1,
            syncStatus: `Scraping Play Store - page ${pageCount}, ${allReviews.length} raw rows`,
          }).catch(() => {})
        }
      }

      if (!continuationToken) {
        keepGoing = false
      }

      if (allReviews.length >= MAX_RAW_REVIEWS || pageCount >= MAX_REVIEW_PAGES) {
        console.warn(`Scrape safeguard hit for ${packageId}`)
        keepGoing = false
      }

    } catch (error) {
      console.error(`Error during gplay.reviews for ${packageId}:`, error.message)
      break
    }
  }

  // Match the old Streamlit checker: compare the exact India calendar date after paging deep enough.
  const filtered = allReviews.filter((review) => {
    return toIstDateKey(review.date) === targetIstDateKey
  })

  console.log(
    `Scrape finished. Total fetched: ${allReviews.length}, exact target IST date: ${filtered.length}`,
  )
  return filtered
}

export const syncAppReviews = async ({
  appId,
  packageId,
  targetDate,
  selectedHint = ',',
  hintMode = 'strict-hint',
  ownerUserId = null,
  stopCheckingAfter = null,
  starRating = null,
}) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const clearSyncUi = async (status = null) => {
    await updateAppLocal(appId, { syncProgress: null, syncStatus: status }).catch(() => {})
  }

  try {
    await updateAppLocal(appId, {
      syncProgress: -1,
      syncStatus: 'Starting sync...',
    })

    const listingDay = getIstListingDayUtcWindow(targetDate)
    if (Number.isNaN(listingDay.startMs) || !listingDay.startIso) {
      await clearSyncUi('Invalid list / target date - fix app listing date and try again.')
      await sleep(5000)
      await clearSyncUi(null)
      return { totalFetched: 0, acceptedAfterFilter: 0, droppedCount: 0, error: 'Invalid target date' }
    }

    const fetchedReviews = await fetchAllReviews({ appId, packageId, targetDate })

    await updateAppLocal(appId, {
      syncProgress: -1,
      syncStatus: `Listing day: ${fetchedReviews.length} review(s) from Play - applying filters...`,
    }).catch(() => {})

  const existingRows = localDb.prepare('SELECT * FROM reviews WHERE appId = ?').all(appId)
  const existingByKey = new Map()
  existingRows.forEach(row => {
    existingByKey.set(row.reviewKey, row)
  })

  const { dayNumber: currentSyncDay } = getIstDayWindowForSync(targetDate)

  // Keys for everything Play returned (date filter only). Used for drops so hint/star
  // filters never mark a still-on-Play review as DROPPED.
  const playReviewKeys = new Set()
  for (const review of fetchedReviews) {
    const userName = review.userName ?? 'Unknown'
    const content = review.text ?? ''
    playReviewKeys.add(makeReviewKey(userName, content))
  }

  const seenKeys = new Set()
  const filteredReviews = fetchedReviews.filter((review) => {
    const hintMatch = matchesReviewByHintMode({
      text: review.text ?? '',
      selectedHint,
      hintMode,
    })
    
    if (starRating !== null && starRating !== undefined && starRating !== '') {
      return hintMatch && Number(review.score) === Number(starRating)
    }
    return hintMatch
  })

  const nowMs = Date.now()
  const stopCheckingMs = stopCheckingAfter ? new Date(stopCheckingAfter).getTime() : null
  const trackingLocked = stopCheckingMs ? nowMs >= stopCheckingMs : false

  const upsertReview = localDb.prepare(`
    INSERT INTO reviews (
      id, appId, packageId, userName, userImage, content, rating, date, status, 
      reviewKey, reviewDayNumber, hintCategory, ownerUserId, firstSeenAt, 
      liveAt, createdAt, updatedAt, replyText, replyDate, thumbsUpCount
    ) VALUES (
      @id, @appId, @packageId, @userName, @userImage, @content, @rating, @date, @status, 
      @reviewKey, @reviewDayNumber, @hintCategory, @ownerUserId, @firstSeenAt, 
      @liveAt, @createdAt, @updatedAt, @replyText, @replyDate, @thumbsUpCount
    ) ON CONFLICT(reviewKey) DO UPDATE SET
      status = excluded.status,
      userImage = excluded.userImage,
      rating = excluded.rating,
      content = excluded.content,
      date = excluded.date,
      replyText = excluded.replyText,
      replyDate = excluded.replyDate,
      thumbsUpCount = excluded.thumbsUpCount,
      liveAt = excluded.liveAt,
      updatedAt = excluded.updatedAt
  `);

  const reviewsToUpsert = [];

  for (let i = 0; i < filteredReviews.length; i++) {
    const review = filteredReviews[i]
    const userName = review.userName ?? 'Unknown'
    const userImage = review.userImage ?? review.userPhoto ?? review.avatar ?? ''
    const content = review.text ?? ''
    const reviewDate = review.date ? new Date(review.date).toISOString() : new Date().toISOString()
    const replyRaw = review.replyContent ?? review.replyText ?? ''
    const replyText =
      replyRaw && String(replyRaw).trim() ? String(replyRaw).trim() : null
    const replyDateRaw = review.replyDate ?? review.reply?.date ?? null
    const replyDate =
      replyDateRaw && !Number.isNaN(new Date(replyDateRaw).getTime())
        ? new Date(replyDateRaw).toISOString()
        : null
    const thumbsRaw = review.thumbsUpCount ?? review.thumbsUp ?? 0
    const thumbsUpCount = Number.isFinite(Number(thumbsRaw))
      ? Math.max(0, Math.floor(Number(thumbsRaw)))
      : 0
    const reviewKey = makeReviewKey(userName, content)
    
    if (seenKeys.has(reviewKey)) continue
    seenKeys.add(reviewKey)

    const existing = existingByKey.get(reviewKey)
    // IMPORTANT: If new, assign to CURRENT sync day. If existing, KEEP original day.
    const reviewDayNumber = existing?.reviewDayNumber ?? currentSyncDay;
    const firstSeenAt = existing?.firstSeenAt ?? new Date().toISOString()

    const payload = {
      id: existing?.id ?? crypto.randomUUID(),
      appId,
      packageId,
      userName,
      userImage,
      content,
      rating: review.score ?? 0,
      date: reviewDate,
      status: 'VERIFIED LIVE',
      hintCategory: getHintCategoryLabel({ hintMode, selectedHint }),
      ownerUserId,
      reviewKey,
      firstSeenAt,
      liveAt: new Date().toISOString(),
      reviewDayNumber,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replyText,
      replyDate,
      thumbsUpCount,
    }

    reviewsToUpsert.push(payload);
  }

  await updateAppLocal(appId, {
    syncProgress: -1,
    syncStatus: `Writing ${reviewsToUpsert.length} review row(s) to database...`,
  }).catch(() => {})

  const dropKeys = existingRows
    .filter(
      (row) =>
        Number(row.reviewDayNumber) === currentSyncDay &&
        row.status === 'VERIFIED LIVE',
    )
    .map((row) => row.reviewKey)
    .filter((key) => !playReviewKeys.has(key))
  const finalDropKeys =
    trackingLocked || playReviewKeys.size === 0 ? [] : dropKeys

  // Transaction for atomic update and cleanup
  const transaction = localDb.transaction((upserts, drops, id, appPayload, syncDay, listStart, listEnd) => {
    const keepKeys = new Set([
      ...upserts.map((row) => row.reviewKey),
      ...drops,
    ])
    const existingCurrentRows = localDb
      .prepare('SELECT reviewKey FROM reviews WHERE appId = ? AND date >= ? AND date < ?')
      .all(id, listStart, listEnd)
    const deleteReview = localDb.prepare('DELETE FROM reviews WHERE appId = ? AND reviewKey = ?')
    for (const row of existingCurrentRows) {
      if (!keepKeys.has(row.reviewKey)) {
        deleteReview.run(id, row.reviewKey)
      }
    }

    // 1. Remove reviews outside the listing IST calendar day (not May 6+ when list date is May 5).
    localDb
      .prepare('DELETE FROM reviews WHERE appId = ? AND (date < ? OR date >= ?)')
      .run(id, listStart, listEnd)

    // 2. Keep only current sync day bucket for this app.
    // Older buckets cannot be reliably reconstructed from Play Store snapshots.
    localDb.prepare('DELETE FROM reviews WHERE appId = ? AND reviewDayNumber != ?').run(id, syncDay);

    // 3. Upsert current reviews
    for (const p of upserts) {
      upsertReview.run(p);
    }

    // 4. Process drops
    if (drops.length > 0) {
      const markDropped = localDb.prepare(`
        UPDATE reviews SET status = 'DROPPED', droppedAt = ?, updatedAt = ? WHERE reviewKey = ?
      `);
      const now = new Date().toISOString();
      for (const k of drops) {
        markDropped.run(now, now, k);
      }
    }

    // 5. Update App
    const columns = Object.keys(appPayload).filter(k => k !== 'id' && k !== 'createdAt')
    const setClause = columns.map(col => `${col} = @${col}`).join(', ')
    const lastSyncedAt = new Date().toISOString()
    const stmt = localDb.prepare(`UPDATE apps SET ${setClause}, lastSyncedAt = ? WHERE id = ?`)
    stmt.run({ ...appPayload }, lastSyncedAt, id)
  })

  transaction(
    reviewsToUpsert,
    finalDropKeys,
    appId,
    {
      packageId,
      selectedHint,
      hintMode,
      ownerUserId,
      syncProgress: 100,
      syncStatus: `Done - ${filteredReviews.length} matched filter, ${finalDropKeys.length} removed from Play`,
    },
    currentSyncDay,
    listingDay.startIso,
    listingDay.endIso,
  )

  await sleep(2200)
  await clearSyncUi(null)

  return {
    totalFetched: fetchedReviews.length,
    acceptedAfterFilter: filteredReviews.length,
    droppedCount: finalDropKeys.length,
  }
  } catch (err) {
    console.error(`syncAppReviews failed for ${packageId}:`, err.message)
    await updateAppLocal(appId, {
      syncProgress: null,
      syncStatus: `Sync failed: ${err.message}`,
    }).catch(() => {})
    await sleep(6000)
    await clearSyncUi(null)
    throw err
  }
}

export const syncAllActiveApps = async () => {
  const apps = localDb.prepare("SELECT * FROM apps WHERE monitoringStatus = 'ACTIVE'").all()
  const now = new Date()
  const todayIst = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const nowMs = now.getTime()

  const shouldSyncToday = (appData) => {
    const targetMs = appData.targetDate ? new Date(appData.targetDate).getTime() : null
    if (!targetMs || Number.isNaN(targetMs)) return false
    if (nowMs < targetMs) return false

    const stopMs = appData.stopCheckingAfter ? new Date(appData.stopCheckingAfter).getTime() : null
    if (stopMs && !Number.isNaN(stopMs) && nowMs > stopMs + 24 * 60 * 60 * 1000) return false

    if (appData.listTime) {
      const currentIstTime = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      if (currentIstTime < appData.listTime) return false

      if (appData.lastSyncedAt) {
        const lastSyncDate = new Date(appData.lastSyncedAt)
        const lastSyncDay = lastSyncDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        
        if (lastSyncDay === todayIst) {
          const lastSyncTimeIst = lastSyncDate.toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
          if (lastSyncTimeIst >= appData.listTime) {
            return false // Already synced today on or after the list time
          }
        }
      }
      return true
    }

    const lastSyncDay = appData.lastSyncedAt
      ? new Date(appData.lastSyncedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : ''
    return lastSyncDay !== todayIst
  }

  const results = []
  for (const appData of apps) {
    if (!shouldSyncToday(appData)) {
      results.push({
        appId: appData.id,
        appName: appData.name ?? appData.packageId,
        skipped: 'Not due for today',
      })
      continue
    }

    try {
      const result = await syncAppReviews({
        appId: appData.id,
        packageId: appData.packageId,
        targetDate: appData.targetDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        selectedHint: appData.selectedHint ?? ',',
        hintMode: appData.hintMode ?? 'strict-hint',
        ownerUserId: appData.ownerUserId ?? null,
        stopCheckingAfter: appData.stopCheckingAfter ?? null,
        starRating: appData.starRating ?? null,
      })
      results.push({ appId: appData.id, appName: appData.name ?? appData.packageId, ...result })
    } catch (error) {
      results.push({ appId: appData.id, appName: appData.name ?? appData.packageId, error: error.message })
    }
  }
  return results
}
