import { 
  createClientLocal, 
  createAppLocal, 
  getClientsLocal 
} from './server/dataService.js';
import { syncAppReviews } from './server/syncEngine.js';
import { generateProofForApp } from './server/proofEngine.js';
import localDb from './server/localDb.js';
import 'dotenv/config';

async function runTest() {
  console.log('🚀 Starting System Test...');

  // 1. Ensure Client exists
  let client = localDb.prepare('SELECT * FROM clients WHERE name = ?').get('Rishabh Singh');
  if (!client) {
    console.log('Creating client: Rishabh Singh...');
    client = await createClientLocal({
      name: 'Rishabh Singh',
      ownerUserId: 'admin-001' // Default admin
    });
  }
  console.log(`✅ Client ready: ${client.name} (ID: ${client.id})`);

  // 2. Add App
  const packageId = 'story.tv.drama.reels';
  const targetDate = '2026-05-11T00:00:00.000Z'; // Today (small data)
  
  // Clean up if app already exists for clean test
  localDb.prepare('DELETE FROM apps WHERE packageId = ? AND clientId = ?').run(packageId, client.id);

  console.log(`Adding app: ${packageId} for client ${client.name}...`);
  const app = await createAppLocal({
    name: 'Story TV Test',
    packageId: packageId,
    storeUrl: `https://play.google.com/store/apps/details?id=${packageId}`,
    clientId: client.id,
    targetDate: targetDate,
    listDate: '2026-05-11',
    listTime: '23:30',
    ratePerReview: 14,
    hintMode: 'show-all',
    selectedHint: '',
    monitoringStatus: 'ACTIVE',
    ownerUserId: 'admin-001'
  });
  console.log(`✅ App added: ${app.name} (ID: ${app.id})`);

  // 3. Trigger Sync
  console.log('🔄 Triggering review sync...');
  const syncResult = await syncAppReviews({
    appId: app.id,
    packageId: app.packageId,
    targetDate: targetDate,
    hintMode: 'show-all',
    selectedHint: '',
    ownerUserId: 'admin-001'
  });
  console.log('✅ Sync complete:', syncResult);

  // Check Database
  const count = localDb.prepare('SELECT count(*) as count FROM reviews WHERE appId = ?').get(app.id);
  console.log(`📊 Total reviews saved in DB: ${count.count}`);

  // 4. Generate Proof (Simulating 3rd or 7th day)
  console.log('🎥 Generating recording/proof...');
  try {
    const proofResult = await generateProofForApp(app, 7);
    console.log('✅ Proof generated:', proofResult);
  } catch (err) {
    console.error('❌ Proof generation failed (expected if Drive not fully setup):', err.message);
  }

  console.log('\n🏁 Test finished. Check Telegram for notifications!');
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
