import { google } from 'googleapis';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const saRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
let sa = JSON.parse(saRaw);
sa = { ...sa, private_key: sa.private_key.replace(/\\n/g, '\n') };

const auth = new google.auth.JWT({
  email: sa.client_email,
  key: sa.private_key,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usersFilePath = path.resolve(__dirname, 'data/users.json');

async function run() {
  const adminFolderId = '1hE_1K11JmtX28AnsEJyygYtDtFDyiLxl'; // REVIEWS WORLD folder
  const rishabhFolderId = '1CZ9lGgERL8wojrGloRptnAkckKXJESwJ'; // Rishabh_Singh folder

  // 1. Move Rishabh_Singh into REVIEWS WORLD
  console.log(`Moving Rishabh_Singh (${rishabhFolderId}) into REVIEWS WORLD (${adminFolderId})...`);
  const file = await drive.files.get({ fileId: rishabhFolderId, fields: 'parents' });
  const previousParents = file.data.parents?.join(',');

  await drive.files.update({
    fileId: rishabhFolderId,
    addParents: adminFolderId,
    removeParents: previousParents,
    fields: 'id, parents'
  });

  // 2. Update Admin's driveFolderId in users.json
  console.log('Updating Admin driveFolderId in users.json...');
  const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
  const adminIndex = users.findIndex(u => u.id === 'admin-001');
  if (adminIndex !== -1) {
    users[adminIndex].driveFolderId = adminFolderId;
    // Also ensure it has a backup folder inside it
    const res = await drive.files.list({
      q: `'${adminFolderId}' in parents and name = 'BACKUP' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)'
    });
    
    let backupId;
    if (res.data.files?.length) {
      backupId = res.data.files[0].id;
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: 'BACKUP',
          parents: [adminFolderId],
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      backupId = created.data.id;
    }
    users[adminIndex].backupFolderId = backupId;
    
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    console.log('Admin user updated successfully.');
  }

  console.log('DONE');
}

run().catch(console.error);
