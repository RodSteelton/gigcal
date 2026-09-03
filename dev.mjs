// Dev runner: the API server (port 5175, /api/extract + /api/info) and
// Vite (port 5174, proxies /api to 5175) together in one command.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const server = spawn(process.execPath, [path.join(root, 'server.js')], { stdio: 'inherit' })
const vite = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')], {
  stdio: 'inherit',
  cwd: root,
})

function shutdown(code) {
  server.kill()
  vite.kill()
  process.exit(code ?? 0)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
vite.on('exit', (code) => shutdown(code))
server.on('exit', (code) => {
  if (code) shutdown(code)
})
