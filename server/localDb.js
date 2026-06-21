import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProofVideoToken } from './auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.resolve(__dirname, '..');
const dbPath = path.join(DATA_DIR, 'reviews.db');

const db = new Database(dbPath, { timeout: 10000 });

// Enable WAL mode to prevent "database is locked" errors
try {
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.warn('Warning: Could not set WAL mode, DB might be busy.');
}

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    appId TEXT,
    packageId TEXT,
    userName TEXT,
    userImage TEXT,
    content TEXT,
    rating INTEGER,
    date TEXT,
    status TEXT,
    reviewKey TEXT UNIQUE,
    reviewDayNumber INTEGER,
    hintCategory TEXT,
    ownerUserId TEXT,
    firstSeenAt TEXT,
    liveAt TEXT,
    droppedAt TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_appId ON reviews(appId);
  CREATE INDEX IF NOT EXISTS idx_reviews_reviewKey ON reviews(reviewKey);
  CREATE INDEX IF NOT EXISTS idx_reviews_ownerUserId ON reviews(ownerUserId);
  CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
  CREATE INDEX IF NOT EXISTS idx_reviews_app_status ON reviews(appId, status);
  CREATE INDEX IF NOT EXISTS idx_reviews_updatedAt ON reviews(updatedAt);

  CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    packageId TEXT,
    storeUrl TEXT,
    name TEXT,
    category TEXT,
    clientId TEXT,
    monitoringStatus TEXT,
    ratePerReview REAL,
    targetCount INTEGER,
    selectedHint TEXT,
    hintMode TEXT,
    proofStatus TEXT,
    proofWebViewLink TEXT,
    proofDriveFileId TEXT,
    driveFolderId TEXT,
    listDate TEXT,
    listTime TEXT,
    targetDate TEXT,
    stopCheckingAfter TEXT,
    starRating INTEGER,
    reviewLink TEXT,
    addedFrom TEXT,
    icon TEXT,
    developer TEXT,
    ownerUserId TEXT,
    syncProgress INTEGER,
    syncStatus TEXT,
    createdAt TEXT,
    lastSyncedAt TEXT,
    telegramNotifiedAt TEXT,
    telegramNotifiedKey TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_apps_ownerUserId ON apps(ownerUserId);
  CREATE INDEX IF NOT EXISTS idx_apps_clientId ON apps(clientId);
  CREATE INDEX IF NOT EXISTS idx_apps_monitoringStatus ON apps(monitoringStatus);

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT,
    driveFolderId TEXT,
    ownerUserId TEXT,
    createdAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_clients_ownerUserId ON clients(ownerUserId);

  CREATE TABLE IF NOT EXISTS password_requests (
    id TEXT PRIMARY KEY,
    userId TEXT,
    email TEXT,
    phone TEXT,
    passwordType TEXT,
    status TEXT DEFAULT 'pending',
    temporaryPassword TEXT,
    resolvedAt TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS proofs (
    id TEXT PRIMARY KEY,
    appId TEXT,
    ownerUserId TEXT,
    clientId TEXT,
    appName TEXT,
    videoUrl TEXT,
    downloadUrl TEXT,
    storagePath TEXT,
    driveFileId TEXT,
    day TEXT,
    date TEXT,
    status TEXT,
    createdAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_proofs_ownerUserId ON proofs(ownerUserId);
  CREATE INDEX IF NOT EXISTS idx_proofs_appId ON proofs(appId);
  CREATE INDEX IF NOT EXISTS idx_proofs_clientId ON proofs(clientId);

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    userId TEXT,
    planId TEXT,
    amountInr INTEGER,
    currency TEXT,
    razorpayOrderId TEXT UNIQUE,
    razorpayPaymentId TEXT,
    status TEXT,
    failureReason TEXT,
    createdAt TEXT,
    paidAt TEXT,
    updatedAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_payments_userId ON payments(userId);
  CREATE INDEX IF NOT EXISTS idx_payments_orderId ON payments(razorpayOrderId);
`);

const reviewColumnNames = () =>
  new Set(db.prepare('PRAGMA table_info(reviews)').all().map((col) => col.name))

const tableColumnNames = (tableName) =>
  new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((col) => col.name))

const ensureReviewColumns = () => {
  const cols = reviewColumnNames()
  if (!cols.has('userImage')) db.exec('ALTER TABLE reviews ADD COLUMN userImage TEXT')
  if (!cols.has('replyText')) db.exec('ALTER TABLE reviews ADD COLUMN replyText TEXT')
  if (!cols.has('replyDate')) db.exec('ALTER TABLE reviews ADD COLUMN replyDate TEXT')
  if (!cols.has('thumbsUpCount')) db.exec('ALTER TABLE reviews ADD COLUMN thumbsUpCount INTEGER DEFAULT 0')
}

const ensureProofColumns = () => {
  const cols = tableColumnNames('proofs')
  if (!cols.has('clientId')) db.exec('ALTER TABLE proofs ADD COLUMN clientId TEXT')
  if (!cols.has('date')) db.exec('ALTER TABLE proofs ADD COLUMN date TEXT')
}

const ensurePaymentColumns = () => {
  const cols = tableColumnNames('payments')
  if (!cols.has('failureReason')) db.exec('ALTER TABLE payments ADD COLUMN failureReason TEXT')
  if (!cols.has('updatedAt')) db.exec('ALTER TABLE payments ADD COLUMN updatedAt TEXT')
}

const ensurePasswordRequestColumns = () => {
  const cols = tableColumnNames('password_requests')
  if (!cols.has('temporaryPassword')) db.exec('ALTER TABLE password_requests ADD COLUMN temporaryPassword TEXT')
  if (!cols.has('resolvedAt')) db.exec('ALTER TABLE password_requests ADD COLUMN resolvedAt TEXT')
}

const ensureAppColumns = () => {
  const cols = tableColumnNames('apps')
  if (!cols.has('telegramNotifiedAt')) db.exec('ALTER TABLE apps ADD COLUMN telegramNotifiedAt TEXT')
  if (!cols.has('telegramNotifiedKey')) db.exec('ALTER TABLE apps ADD COLUMN telegramNotifiedKey TEXT')
}

ensureReviewColumns()
ensureProofColumns()
ensurePaymentColumns()
ensurePasswordRequestColumns()
ensureAppColumns()

const backfillProofClientIdsFromApps = () => {
  try {
    const stmt = db.prepare(`
      UPDATE proofs
      SET clientId = (SELECT a.clientId FROM apps a WHERE a.id = proofs.appId)
      WHERE (proofs.clientId IS NULL OR TRIM(proofs.clientId) = '')
        AND EXISTS (
          SELECT 1 FROM apps a2
          WHERE a2.id = proofs.appId AND a2.clientId IS NOT NULL AND TRIM(a2.clientId) != ''
        )
    `)
    const info = stmt.run()
    if (info.changes > 0) {
      console.log(`[localDb] Linked ${info.changes} proof row(s) to app clientId for gallery folders.`)
    }
  } catch (err) {
    console.warn('[localDb] proof clientId backfill:', err.message)
  }
}

backfillProofClientIdsFromApps()

const backfillLocalProofSignedUrls = () => {
  try {
    const localProofs = db
      .prepare(
        "SELECT id, videoUrl FROM proofs WHERE (driveFileId IS NULL OR TRIM(driveFileId) = '') AND (videoUrl IS NULL OR videoUrl NOT LIKE '%token=%')",
      )
      .all()
    const update = db.prepare('UPDATE proofs SET videoUrl = ?, downloadUrl = ? WHERE id = ?')
    for (const proof of localProofs) {
      const token = createProofVideoToken(proof.id)
      const url = `/api/proof-video?proofId=${encodeURIComponent(proof.id)}&token=${encodeURIComponent(token)}`
      update.run(url, url, proof.id)
    }
    if (localProofs.length > 0) {
      console.log(`[localDb] Signed ${localProofs.length} local proof video link(s).`)
    }
  } catch (err) {
    console.warn('[localDb] local proof URL backfill:', err.message)
  }
}

backfillLocalProofSignedUrls()

const backfillAppProofLinksFromLatestProofs = () => {
  try {
    const latestProofs = db
      .prepare(
        `SELECT p.*
         FROM proofs p
         INNER JOIN (
           SELECT appId, MAX(createdAt) AS maxCreatedAt
           FROM proofs
           GROUP BY appId
         ) latest
           ON latest.appId = p.appId AND latest.maxCreatedAt = p.createdAt
         WHERE p.videoUrl IS NOT NULL AND TRIM(p.videoUrl) != ''`,
      )
      .all()
    const update = db.prepare(
      "UPDATE apps SET proofStatus = COALESCE(proofStatus, ?), proofWebViewLink = ? WHERE id = ? AND (proofWebViewLink IS NULL OR proofWebViewLink NOT LIKE '%token=%')",
    )
    let changed = 0
    for (const proof of latestProofs) {
      changed += update.run(proof.status || 'LOCAL_READY', proof.videoUrl, proof.appId).changes
    }
    if (changed > 0) {
      console.log(`[localDb] Linked ${changed} app proof URL(s) from latest proofs.`)
    }
  } catch (err) {
    console.warn('[localDb] app proof URL backfill:', err.message)
  }
}

backfillAppProofLinksFromLatestProofs()

export default db;
