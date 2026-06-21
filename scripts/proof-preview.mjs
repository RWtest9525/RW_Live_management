import 'dotenv/config'
import localDb from '../server/localDb.js'
import { generateProofForApp } from '../server/proofEngine.js'

const row =
  localDb.prepare("SELECT * FROM apps WHERE monitoringStatus = 'ACTIVE' LIMIT 1").get() ??
  localDb.prepare('SELECT * FROM apps LIMIT 1').get()

if (!row) {
  console.error('No apps in reviews.db — add an app in the portal first.')
  process.exit(1)
}

console.log(`Generating proof preview for: ${row.name ?? row.packageId} (${row.id})`)
console.log('Ensure dev server is running (npm run dev) so /record can load.')

const result = await generateProofForApp(row, 7, { localOnly: true })
console.log('Result:', result)
