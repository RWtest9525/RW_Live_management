import localDb from './server/localDb.js'
import { encryptText, decryptText, maskApiKey } from './server/cryptoUtils.js'

async function verifyOverhaul() {
  console.log('=== OVERHAUL VERIFICATION SUITE ===\n')

  // 1. Verify Database Schema
  console.log('1. Testing Database Schema Initialization...')
  const tables = ['reviews', 'apps', 'clients', 'api_connections', 'client_api_keys', 'sync_history', 'failed_requests', 'audit_logs']
  for (const t of tables) {
    const info = localDb.prepare(`PRAGMA table_info(${t})`).all()
    if (info.length === 0) {
      throw new Error(`Table missing: ${t}`)
    }
    console.log(`  ✓ Table '${t}' exists with ${info.length} columns.`)
  }

  // 2. Verify Crypto Encryption/Decryption
  console.log('\n2. Testing AES-256-GCM Crypto Module...')
  const secretKey = 'test_api_key_99887766554433221100aabbccddeeff'
  const encrypted = encryptText(secretKey)
  const decrypted = decryptText(encrypted)
  const masked = maskApiKey(secretKey)

  console.log(`  Original : ${secretKey}`)
  console.log(`  Encrypted: ${encrypted}`)
  console.log(`  Decrypted: ${decrypted}`)
  console.log(`  Masked   : ${masked}`)

  if (decrypted !== secretKey) throw new Error('Crypto decryption mismatch!')
  if (masked !== 'test_api...eeff') throw new Error('Crypto masking mismatch!')
  console.log('  ✓ Crypto module verified successfully.')

  // 3. Verify Client API Keys DB CRUD Operations
  console.log('\n3. Testing Client API Keys SQLite Operations...')
  const testClientName = 'Verification Test Client'
  const testKey = 'test_key_sample_1234567890abcdef'
  const encryptedKey = encryptText(testKey)

  const insert = localDb.prepare(`
    INSERT INTO client_api_keys (
      client_name, api_key, encrypted_api_key, subscription_plan,
      start_date, expiry_date, request_limit, requests_used,
      status, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    testClientName, testKey, encryptedKey, 'Monthly',
    new Date().toISOString(), new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    5000, 0, 'active', 1, new Date().toISOString(), new Date().toISOString()
  )

  const insertedId = insert.lastInsertRowid
  console.log(`  ✓ Inserted Client API Key with ID: ${insertedId}`)

  const fetched = localDb.prepare('SELECT * FROM client_api_keys WHERE id = ?').get(insertedId)
  if (fetched.client_name !== testClientName) throw new Error('Client name mismatch in DB!')
  console.log(`  ✓ Fetched Client API Key for '${fetched.client_name}' successfully.`)

  // Cleanup test row
  localDb.prepare('DELETE FROM client_api_keys WHERE id = ?').run(insertedId)
  console.log('  ✓ Cleaned up test client row.')

  // 4. Verify API Connection State
  console.log('\n4. Testing API Connection Table State...')
  const connState = localDb.prepare('SELECT * FROM api_connections WHERE id = ?').get('primary')
  if (!connState) {
    console.log('  ✓ Connection table clean (Not yet connected).')
  } else {
    console.log(`  ✓ Stored Connection Status: ${connState.status}, Health: ${connState.healthStatus}`)
  }

  console.log('\n=== ALL OVERHAUL VERIFICATION CHECKS PASSED PERFECTLY ===')
}

verifyOverhaul().catch(err => {
  console.error('Verification Error:', err)
  process.exit(1)
})
