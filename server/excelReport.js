import localDb from './localDb.js'
import { utils, write } from 'xlsx'

const IST_OFFSET_MINUTES = 330

export const toIstParts = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '', dateTime: '' }
  }
  const ist = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000)
  const iso = ist.toISOString()
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 19),
    dateTime: `${iso.slice(0, 10)} ${iso.slice(11, 19)} IST`,
  }
}

export const getIstDayUtcWindow = (dateKey) => {
  if (!dateKey) return null
  const parsed = new Date(`${dateKey}T00:00:00+05:30`)
  if (Number.isNaN(parsed.getTime())) return null
  return {
    startIso: parsed.toISOString(),
    endIso: new Date(parsed.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

const safeFileName = (value) =>
  String(value || 'Report')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)

export const buildReviewExcelBuffer = ({ reviews, fileName = 'report.xlsx' }) => {
  if (!reviews?.length) {
    const error = new Error('No data found to export')
    error.statusCode = 404
    throw error
  }

  const formattedData = reviews.map((r, index) => {
    const posted = toIstParts(r.date)
    const dropped = r.droppedAt ? toIstParts(r.droppedAt) : null
    return {
      'S.No': index + 1,
      'User Name': r.userName,
      'Review Content': r.content,
      Rating: `${r.rating}/5`,
      'Review Date': posted.date,
      'Review Time': posted.time,
      'Posted At (IST)': posted.dateTime,
      'Raw Play Store Time': r.date,
      ...(dropped ? { 'Dropped At (IST)': dropped.dateTime } : {}),
    }
  })

  const wb = utils.book_new()
  const ws = utils.json_to_sheet(formattedData)
  ws['!cols'] = [
    { wch: 8 },
    { wch: 24 },
    { wch: 60 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
    { wch: 28 },
    { wch: 24 },
  ]

  utils.book_append_sheet(wb, ws, 'Reviews')
  return {
    fileName: safeFileName(fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`),
    buffer: write(wb, { type: 'buffer', bookType: 'xlsx' }),
  }
}

export const getVerifiedReviewsForAppDate = ({ appId, date }) => {
  let query = "SELECT userName, content, rating, date FROM reviews WHERE appId = ? AND status = 'VERIFIED LIVE'"
  const params = [appId]
  if (date) {
    const window = getIstDayUtcWindow(date)
    if (window) {
      query += ' AND date >= ? AND date < ?'
      params.push(window.startIso, window.endIso)
    }
  }
  return localDb.prepare(`${query} ORDER BY datetime(date) DESC, rowid DESC`).all(...params)
}

export const getDroppedReviewsForAppDate = ({ appId, date }) => {
  let query = "SELECT userName, content, rating, date, droppedAt FROM reviews WHERE appId = ? AND status = 'DROPPED'"
  const params = [appId]
  if (date) {
    const window = getIstDayUtcWindow(date)
    if (window) {
      query += ' AND date >= ? AND date < ?'
      params.push(window.startIso, window.endIso)
    }
  }
  return localDb.prepare(`${query} ORDER BY datetime(date) DESC, rowid DESC`).all(...params)
}
