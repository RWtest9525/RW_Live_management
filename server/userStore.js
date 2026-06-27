import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.resolve(__dirname, '../data')
const usersFilePath = path.join(DATA_DIR, 'users.json')

let cachedUsers = null

const ensureUsersFile = () => {
  const dir = path.dirname(usersFilePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(usersFilePath)) {
    const defaultPasswordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Yash@952518', 10)
    const adminUser = {
      id: 'admin-001',
      name: 'REVIEWS WORLD',
      email: (process.env.ADMIN_EMAIL || 'reviewsworld01@gmail.com').toLowerCase(),
      phone: '',
      passwordHash: defaultPasswordHash,
      role: 'admin',
      accessPlan: 'lifetime',
      validUntil: null,
      status: 'active',
      driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '1y2sdLfLoPCG8q7V21YL-jBOwA65pbII9',
      createdAt: new Date().toISOString(),
    }
    fs.writeFileSync(usersFilePath, JSON.stringify([adminUser], null, 2))
    console.log('Created default admin user')
    cachedUsers = [adminUser]
    return [adminUser]
  }
  return null
}

export const getUsers = () => {
  if (cachedUsers) return cachedUsers
  
  ensureUsersFile()
  try {
    const data = fs.readFileSync(usersFilePath, 'utf-8')
    cachedUsers = JSON.parse(data)
    return cachedUsers
  } catch (err) {
    console.error('Error reading users file:', err)
    return []
  }
}

export const saveUsers = (users) => {
  cachedUsers = users
  const tempPath = `${usersFilePath}.tmp`
  try {
    fs.writeFileSync(tempPath, JSON.stringify(users, null, 2))
    fs.renameSync(tempPath, usersFilePath)
  } catch (err) {
    console.error('Error saving users file:', err)
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath) } catch (e) {}
    }
    throw err
  }
}

export const findUserByEmail = (email) => {
  const users = getUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase())
}

export const findUserById = (id) => {
  const users = getUsers()
  return users.find(u => u.id === id)
}

export const createUser = async ({
  name,
  email,
  phone,
  password,
  role = 'user',
  accessPlan = 'free',
  validUntil = null,
  driveFolderId = null,
  backupFolderId = null,
  telegramBotToken = '',
  telegramChatId = '',
}) => {
  const users = getUsers()
  
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('User already exists with this email.')
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const newUser = {
    id: `user-${Date.now()}`,
    name,
    email: email.toLowerCase(),
    phone: phone || '',
    passwordHash,
    role,
    accessPlan,
    validUntil,
    status: 'pending',
    driveFolderId: driveFolderId,
    backupFolderId: backupFolderId,
    telegramBotToken: telegramBotToken || '',
    telegramChatId: telegramChatId || '',
    createdAt: new Date().toISOString(),
  }

  users.push(newUser)
  saveUsers(users)
  return newUser
}

export const authenticateUser = async ({ email, password }) => {
  const user = findUserByEmail(email)
  if (!user) return null
  
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return null
  
  const { passwordHash, ...userWithoutPassword } = user
  return userWithoutPassword
}

export const updateUserById = (id, updates) => {
  const users = getUsers()
  const index = users.findIndex(u => u.id === id)
  if (index === -1) throw new Error('User not found')
  
  users[index] = { ...users[index], ...updates }
  saveUsers(users)
  return users[index]
}

export const setUserPasswordById = async (id, password) => {
  const passwordHash = await bcrypt.hash(password, 10)
  return updateUserById(id, { passwordHash, lastPasswordResetAt: new Date().toISOString() })
}
