import 'dotenv/config'
import { restoreDbFromDrive } from './server/dbBackup.js'

console.log('[startup] Booting server, running initial restore from Google Drive...')
try {
  await restoreDbFromDrive()
} catch (err) {
  console.error('[startup] Failed to restore database:', err.message)
}

// Now boot the actual server
await import('./local-server.js')
