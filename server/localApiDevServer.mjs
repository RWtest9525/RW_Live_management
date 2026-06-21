import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const envPath = path.join(projectRoot, '.env')

const loadEnvFile = () => {
  if (!existsSync(envPath)) return
  const raw = readFileSync(envPath, 'utf8')
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) return
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1)
    if (!process.env[key]) {
      process.env[key] = value
    }
  })
}

loadEnvFile()

const routes = {
  '/api/admin-users': './api/admin-users.js',
  '/api/app-lookup': './api/app-lookup.js',
  '/api/auth-forgot-password': './api/auth-forgot-password.js',
  '/api/auth-login': './api/auth-login.js',
  '/api/auth-me': './api/auth-me.js',
  '/api/auth-signup': './api/auth-signup.js',
  '/api/automation-run': './api/automation-run.js',
  '/api/cron-daily-report': './api/cron-daily-report.js',
  '/api/sync-reviews': './api/sync-reviews.js',
  '/api/verify-connections': './api/verify-connections.js',
}

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

const createResponse = (nodeRes) => {
  const response = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    status(code) {
      this.statusCode = code
      return this
    },
    setHeader(name, value) {
      this.headers[name] = value
    },
    json(payload) {
      if (this.headersSent) return this
      nodeRes.writeHead(this.statusCode, {
        'Content-Type': 'application/json',
        ...this.headers,
      })
      nodeRes.end(JSON.stringify(payload))
      this.headersSent = true
      return this
    },
    send(payload) {
      if (this.headersSent) return this
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
      nodeRes.writeHead(this.statusCode, this.headers)
      nodeRes.end(body)
      this.headersSent = true
      return this
    },
  }

  return response
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3001')
  const routePath = url.pathname
  const routeModule = routes[routePath]

  if (!routeModule) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  try {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const rawBody = Buffer.concat(chunks).toString('utf8')
    let body = {}
    if (rawBody) {
      try {
        body = JSON.parse(rawBody)
      } catch {
        body = rawBody
      }
    }

    const handlerUrl = pathToFileURL(path.resolve(projectRoot, routeModule)).href
    const { default: handler } = await import(handlerUrl)
    const request = {
      method: req.method,
      headers: req.headers,
      url: req.url,
      query: Object.fromEntries(url.searchParams.entries()),
      body,
    }
    const response = createResponse(res)

    await handler(request, response)

    if (!response.headersSent) {
      sendJson(res, response.statusCode ?? 200, { ok: true })
    }
  } catch (error) {
    sendJson(res, 500, {
      error: error?.message ?? 'Local API server error',
    })
  }
})

server.listen(3001, () => {
  console.log('Local API server running on http://localhost:3001')
})
