import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { getDriveAuth } from '../server/googleDriveAuth.js';
import { ensureSubFolder } from '../server/driveStorage.js';
import { getUsers } from '../server/userStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!rootFolderId) {
  console.error('Error: GOOGLE_DRIVE_FOLDER_ID environment variable is not set.');
  process.exit(1);
}

const { auth } = getDriveAuth();
if (!auth) {
  console.error('Error: Google Drive authentication not configured.');
  process.exit(1);
}

const drive = google.drive({ version: 'v3', auth });
const GDRIVE_ALL = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
};

async function migrate() {
  console.log('Starting Google Drive structure migration...');
  console.log(`Root Folder ID (RW List Management): ${rootFolderId}`);

  // 1. Ensure "System Backups" folder exists
  console.log('\n--- Ensuring "System Backups" folder exists ---');
  const systemBackupsFolderId = await ensureSubFolder({
    parentFolderId: rootFolderId,
    folderName: 'System Backups',
  });
  console.log(`"System Backups" folder ID: ${systemBackupsFolderId}`);

  // 2. Move existing reviews.db, users.json, and test documents to "System Backups"
  console.log('\n--- Moving backup files and test documents ---');
  try {
    // List files in the root folder
    const listRes = await drive.files.list({
      ...GDRIVE_ALL,
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
    });
    
    const files = listRes.data.files || [];
    for (const file of files) {
      const isDb = file.name === 'reviews.db';
      const isUsers = file.name === 'users.json';
      const isTestFile = file.name.startsWith('rw-drive-test-');

      if (isDb || isUsers || isTestFile) {
        console.log(`Moving file "${file.name}" (${file.id}) into "System Backups"...`);
        // Fetch current parents to remove them
        const fileMeta = await drive.files.get({
          ...GDRIVE_ALL,
          fileId: file.id,
          fields: 'parents',
        });
        const currentParents = fileMeta.data.parents?.join(',') || '';

        await drive.files.update({
          ...GDRIVE_ALL,
          fileId: file.id,
          addParents: systemBackupsFolderId,
          removeParents: currentParents,
          fields: 'id, parents',
        });
        console.log(`Successfully moved "${file.name}"`);
      }
    }
  } catch (err) {
    console.error('Failed to migrate backup files:', err.message);
  }

  // 3. Move client folders into their respective owner user's folders
  console.log('\n--- Moving client folders into user folders ---');
  const dbPath = path.resolve(__dirname, '../reviews.db');
  const db = new Database(dbPath);
  const users = getUsers();

  try {
    const clients = db.prepare('SELECT id, name, driveFolderId, ownerUserId FROM clients').all();
    console.log(`Found ${clients.length} clients in database to check.`);

    for (const client of clients) {
      if (!client.driveFolderId) {
        console.log(`Client "${client.name}" has no driveFolderId. Skipping.`);
        continue;
      }

      const owner = users.find(u => u.id === client.ownerUserId);
      if (!owner) {
        console.log(`Owner user not found for client "${client.name}" (ownerUserId: ${client.ownerUserId}). Skipping.`);
        continue;
      }

      if (!owner.driveFolderId) {
        console.log(`Owner user "${owner.name}" has no driveFolderId configured. Skipping client "${client.name}".`);
        continue;
      }

      console.log(`Checking client folder for "${client.name}" (${client.driveFolderId}). Should be inside owner folder: "${owner.name}" (${owner.driveFolderId})...`);

      try {
        const clientFolderMeta = await drive.files.get({
          ...GDRIVE_ALL,
          fileId: client.driveFolderId,
          fields: 'parents',
        });

        const currentParents = clientFolderMeta.data.parents || [];
        if (!currentParents.includes(owner.driveFolderId)) {
          console.log(`Moving client folder "${client.name}" into user folder "${owner.name}"...`);
          await drive.files.update({
            ...GDRIVE_ALL,
            fileId: client.driveFolderId,
            addParents: owner.driveFolderId,
            removeParents: currentParents.join(','),
            fields: 'id, parents',
          });
          console.log(`Successfully moved client "${client.name}" folder.`);
        } else {
          console.log(`Client folder for "${client.name}" is already in the correct owner folder.`);
        }
      } catch (err) {
        console.error(`Error processing client "${client.name}" folder:`, err.message);
      }
    }
  } catch (err) {
    console.error('Failed to migrate client folders:', err.message);
  }

  console.log('\nGoogle Drive structure migration completed.');
}

migrate().catch(console.error);
