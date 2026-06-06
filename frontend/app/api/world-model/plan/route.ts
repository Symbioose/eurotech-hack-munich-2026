import { spawn } from 'child_process'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000'
const BACKEND_START_TIMEOUT_MS = 45_000
const BACKEND_POLL_MS = 750
let backendStartPromise: Promise<void> | null = null

function backendUrl() {
  return (process.env.WORLD_MODEL_API_URL ?? DEFAULT_BACKEND_URL).replace(/\/$/, '')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isBackendReady() {
  try {
    const res = await fetch(`${backendUrl()}/health`, { cache: 'no-store' })
    if (!res.ok) return false
    const body = (await res.json()) as { model_ready?: boolean }
    return body.model_ready === true
  } catch {
    return false
  }
}

function startBackendProcess() {
  const backendDir = path.resolve(process.cwd(), '..', 'backend')
  const child = spawn('uv', ['run', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'], {
    cwd: backendDir,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

async function ensureBackendReady() {
  if (await isBackendReady()) return

  if (!backendStartPromise) {
    backendStartPromise = (async () => {
      startBackendProcess()
      const start = Date.now()
      while (Date.now() - start < BACKEND_START_TIMEOUT_MS) {
        if (await isBackendReady()) return
        await sleep(BACKEND_POLL_MS)
      }
      throw new Error(
        `World-model backend did not become ready within ${Math.round(BACKEND_START_TIMEOUT_MS / 1000)}s`
      )
    })().finally(() => {
      backendStartPromise = null
    })
  }

  await backendStartPromise
}

export async function POST(req: Request) {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  try {
    await ensureBackendReady()
    const res = await fetch(`${backendUrl()}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    const body = await res.json()
    return Response.json(body, { status: res.ok ? 200 : res.status })
  } catch (error) {
    return Response.json(
      {
        error:
          `Could not connect to the world-model backend at ${backendUrl()}. ` +
          `Auto-start failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      },
      { status: 503 }
    )
  }
}
