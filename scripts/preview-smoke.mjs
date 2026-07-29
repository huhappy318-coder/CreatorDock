import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import net from 'node:net'

const host = '127.0.0.1'
const port = Number(process.env.CREATORDOCK_PREVIEW_PORT ?? '4174')
const basePath = normalizeBasePath(process.env.CREATORDOCK_BASE_PATH ?? '/CreatorDock/')
const origin = `http://${host}:${port}`
const previewUrl = `${origin}${basePath}`
const tscPath = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url))
const vitePath = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const playwrightPath = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url))

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`CREATORDOCK_PREVIEW_PORT must be an integer from 1024 through 65535; received ${port}.`)
}
if (await isPortListening(host, port)) {
  throw new Error(`Refusing to start the preview because ${host}:${port} is already occupied.`)
}

await run(process.execPath, [tscPath, '-b'], { name: 'TypeScript build' })
await run(process.execPath, [vitePath, 'build', `--base=${basePath}`], { name: 'Vite production build' })
await run(process.execPath, [fileURLToPath(new URL('./check-dist.mjs', import.meta.url))], {
  name: 'static artifact check',
  env: { CREATORDOCK_BASE_PATH: basePath },
})

const preview = spawn(process.execPath, [
  vitePath,
  'preview',
  '--host',
  host,
  '--port',
  String(port),
  '--strictPort',
], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, CREATORDOCK_BASE_PATH: basePath },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})

let previewOutput = ''
preview.stdout.on('data', (chunk) => {
  const text = String(chunk)
  previewOutput += text
  process.stdout.write(text)
})
preview.stderr.on('data', (chunk) => {
  const text = String(chunk)
  previewOutput += text
  process.stderr.write(text)
})

let httpEvidence
let browserExitCode = 1
try {
  httpEvidence = await waitForCreatorDock(previewUrl, preview)
  browserExitCode = await run(process.execPath, [playwrightPath, 'test'], {
    name: 'Playwright browser checks',
    allowFailure: true,
    env: { CREATORDOCK_BASE_URL: previewUrl },
  })
  if (browserExitCode !== 0) {
    throw new Error(`Playwright browser checks exited with code ${browserExitCode}.`)
  }
}
finally {
  const stopped = await stopSpawnedProcess(preview)
  console.log(JSON.stringify({
    previewUrl,
    previewProcessId: preview.pid,
    httpStatus: httpEvidence?.status ?? null,
    creatorDockMarker: httpEvidence?.creatorDockMarker ?? false,
    browserExitCode,
    spawnedPreviewStopped: stopped,
    previewOutput: previewOutput.trim(),
  }, null, 2))
}

function normalizeBasePath(value) {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function isPortListening(hostname, portNumber) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostname, port: portNumber })
    const finish = (listening) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(listening)
    }
    socket.setTimeout(500)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function run(command, args, { name, env = {}, allowFailure = false }) {
  const child = spawn(command, args, {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, ...env },
    stdio: 'inherit',
    windowsHide: true,
  })
  const [code, signal] = await once(child, 'exit')
  const exitCode = code ?? 1
  if (!allowFailure && exitCode !== 0) {
    throw new Error(`${name} failed with exit code ${exitCode}${signal ? ` and signal ${signal}` : ''}.`)
  }
  return exitCode
}

async function waitForCreatorDock(url, child) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Preview exited before HTTP readiness with code ${child.exitCode}.`)
    }
    try {
      const response = await fetch(url)
      const body = await response.text()
      const creatorDockMarker = body.includes('<title>CreatorDock</title>') && /id=["']root["']/.test(body)
      if (response.ok && creatorDockMarker) {
        return { status: response.status, creatorDockMarker }
      }
    }
    catch {
      // The preview may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`CreatorDock did not become ready at ${url} within 20 seconds.`)
}

async function stopSpawnedProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return true
  child.kill('SIGTERM')
  const exited = await Promise.race([
    once(child, 'exit').then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ])
  if (!exited && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await once(child, 'exit')
  }
  return child.exitCode !== null || child.signalCode !== null
}
