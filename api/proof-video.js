import fs from 'node:fs'
import path from 'node:path'
import localDb from '../server/localDb.js'
import { getDriveFileMediaMetadata, streamDriveFile } from '../server/driveStorage.js'
import {
  createProofVideoToken,
  readAuthUserFromRequest,
  verifySignedToken,
} from '../server/auth.js'

const isPathInside = (childPath, parentPath) => {
  const relative = path.relative(parentPath, childPath)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

const parseByteRange = (rangeHeader, size) => {
  if (!rangeHeader || !Number.isFinite(size) || size <= 0) return null
  const match = String(rangeHeader).match(/^bytes=(\d*)-(\d*)$/)
  if (!match) return null

  let start
  let end
  if (match[1] === '' && match[2] === '') return null
  if (match[1] === '') {
    const suffixLength = Number.parseInt(match[2], 10)
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number.parseInt(match[1], 10)
    end = match[2] === '' ? size - 1 : Number.parseInt(match[2], 10)
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return { invalid: true }
  }

  return { start, end: Math.min(end, size - 1) }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { proofId, token } = req.query
    if (!proofId) return res.status(400).json({ error: 'proofId is required' })

    const proof = localDb.prepare('SELECT * FROM proofs WHERE id = ?').get(proofId)
    if (!proof) return res.status(404).json({ error: 'Proof not found' })

    const signed = verifySignedToken(token)
    const signedOk = signed?.typ === 'proof-video' && signed.proofId === proofId

    if (!signedOk) {
      const user = await readAuthUserFromRequest(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })
      if (user.role !== 'admin' && proof.ownerUserId !== user.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const refreshedToken = createProofVideoToken(proofId)
      const refreshedUrl = `/api/proof-video?proofId=${encodeURIComponent(proofId)}&token=${encodeURIComponent(refreshedToken)}`
      if (proof.videoUrl !== refreshedUrl) {
        localDb
          .prepare('UPDATE proofs SET videoUrl = ?, downloadUrl = ? WHERE id = ?')
          .run(refreshedUrl, refreshedUrl, proofId)
      }
    }

    if (proof.driveFileId) {
      const metadata = await getDriveFileMediaMetadata({ fileId: proof.driveFileId })
      const fileSize = Number(metadata?.size || 0)
      const mimeType = metadata?.mimeType || 'video/mp4'
      const rangeInfo = parseByteRange(req.headers.range, fileSize)
      if (rangeInfo?.invalid) {
        res.setHeader('Content-Range', `bytes */${fileSize}`)
        return res.status(416).end()
      }

      const driveRange =
        rangeInfo && fileSize > 0 ? `bytes=${rangeInfo.start}-${rangeInfo.end}` : req.headers.range
      const driveResponse = await streamDriveFile({
        fileId: proof.driveFileId,
        range: driveRange,
      })

      const statusCode = rangeInfo && fileSize > 0 ? 206 : 200
      res.status(statusCode)
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Type', mimeType)
      res.setHeader('Content-Disposition', `inline; filename="${metadata?.name || `${proof.id}.mp4`}"`)
      if (rangeInfo && fileSize > 0) {
        res.setHeader('Content-Length', rangeInfo.end - rangeInfo.start + 1)
        res.setHeader('Content-Range', `bytes ${rangeInfo.start}-${rangeInfo.end}/${fileSize}`)
      } else if (fileSize > 0) {
        res.setHeader('Content-Length', fileSize)
      }
      return driveResponse.data.pipe(res)
    }

    const tempRoot = path.resolve(process.cwd(), '.tmp-proof')
    const filePath = path.resolve(proof.storagePath || '')
    if (!isPathInside(filePath, tempRoot) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Local proof video not found' })
    }

    const stat = fs.statSync(filePath)
    const range = req.headers.range
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Disposition', `inline; filename="${proof.id}.mp4"`)

    if (range) {
      const [startRaw, endRaw] = range.replace(/bytes=/, '').split('-')
      const start = Number.parseInt(startRaw, 10)
      const end = endRaw ? Number.parseInt(endRaw, 10) : stat.size - 1
      if (Number.isNaN(start) || Number.isNaN(end) || start >= stat.size || end >= stat.size) {
        res.setHeader('Content-Range', `bytes */${stat.size}`)
        return res.status(416).end()
      }

      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
      res.setHeader('Content-Length', end - start + 1)
      return fs.createReadStream(filePath, { start, end }).pipe(res)
    }

    res.setHeader('Content-Length', stat.size)
    return fs.createReadStream(filePath).pipe(res)
  } catch (error) {
    console.error('proof-video failed:', error)
    return res.status(500).json({ error: error.message })
  }
}
