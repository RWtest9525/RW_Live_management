import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { backupDbToDrive } from './server/dbBackup.js'

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥', err.name, err.message)
  console.error(err.stack)
})

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥', err.name, err.message)
  console.error(err.stack)
})

import { startAutomationWorker } from './workers/automationWorker.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())

// Wrapper to adapt Vercel-style handlers to Express
const adaptHandler = (handler) => async (req, res) => {
  const requestId = Math.random().toString(36).slice(7)
  console.log(`[${requestId}] ${req.method} ${req.url} - Started`)
  const start = Date.now()
  
  try {
    await handler(req, res)
    const duration = Date.now() - start
    console.log(`[${requestId}] ${req.method} ${req.url} - Finished (${duration}ms)`)
  } catch (error) {
    const duration = Date.now() - start
    console.error(`[${requestId}] ${req.method} ${req.url} - Failed (${duration}ms):`, error)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal Server Error' })
    }
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() })
})

// Automatically register all handlers in the api/ directory
const apiDir = path.join(__dirname, 'api')
if (fs.existsSync(apiDir)) {
  const files = fs.readdirSync(apiDir)

  console.log('--- Registering API Routes ---')
  for (const file of files) {
    if (file.endsWith('.js')) {
      const routeName = `/api/${file.replace('.js', '')}`
      const modulePath = `./api/${file}`
      try {
        const { default: handler } = await import(modulePath)
        if (typeof handler === 'function') {
          app.all(routeName, adaptHandler(handler))
          console.log(`Registered: ${routeName}`)
        }
      } catch (err) {
        console.error(`CRITICAL: Failed to load API route ${routeName} from ${modulePath}:`, err.message)
      }
    }
  }
} else {
  console.warn('WARNING: api/ directory not found.')
}

// Special case for Excel download to handle buffers correctly
import excelHandler from './api/download-excel.js'
app.get('/api/download-excel', adaptHandler(excelHandler))

// Serve static files from the dist directory in production
const distDir = path.join(__dirname, 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*any', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
  console.log(`Serving static files from: ${distDir}`)
}

const PORT = process.env.PORT || 3000
const server = app.listen(PORT, '0.0.0.0', async () => {
  try {
    const { default: localDb } = await import('./server/localDb.js')
    const cleared = localDb.prepare('UPDATE apps SET syncProgress = NULL WHERE syncProgress IS NOT NULL').run()
    if (cleared.changes > 0) {
      console.log(`[startup] Cleared stale syncProgress on ${cleared.changes} app(s) (server restarted mid-sync).`)
    }
  } catch (e) {
    console.warn('[startup] syncProgress cleanup skipped:', e.message)
  }

  console.log(`\n🚀 Backend Server running at http://localhost:${PORT}`)
  console.log(`🌐 Network access at http://[Your-IP]:${PORT}`)
  console.log('--- Starting Automation Worker ---')
  try {
    startAutomationWorker()
    console.log('Cron active: 5-minute sync and daily reports are scheduled.')
  } catch (err) {
    console.error('Failed to start automation worker:', err.message)
  }
})

// Schedule periodic database backups to Google Drive
setInterval(async () => {
  try {
    await backupDbToDrive()
  } catch (err) {
    console.error('[backup] Scheduled DB backup failed:', err.message)
  }
}, 5 * 60 * 1000) // Every 5 minutes

// Add graceful shutdown with database backup
const handleShutdown = async (signal) => {
  console.log(`${signal} received: backing up DB and closing HTTP server...`)
  try {
    await backupDbToDrive()
  } catch (err) {
    console.error('[backup] Shutdown DB backup failed:', err.message)
  }
  server.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))
