// process: Splectral's server as its own process: the program, started,
// its state read, ended (README.md beside it).
import process from 'bare-process'
import os from 'bare-os'
import { spawnSync } from 'bare-subprocess'
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'bare-fs'
import { join } from 'bare-path'
import { serve, PORT, ROOT } from '../serve/index.js'

// Its state, in the mrepo's own folder while it runs: { pid, url, port,
// outbox, root, started }.
export const STATE = 'splectral.json'

// catch: no such process: not alive
const alive = pid => { try { os.kill(pid, 0); return true } catch { return false } }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

// The server's state as it wrote it; null when none runs (no state, or
// one left by a process that is gone).
export function stateOf (dir) {
  const file = join(dir, STATE)
  if (!existsSync(file)) return null
  let state = null
  // catch: not whole or not JSON: no state to go by
  try { state = JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
  return Number.isInteger(state?.pid) && alive(state.pid) ? state : null
}

// The program: the server run in this process until it is ended (SIGTERM,
// SIGINT), its mrepo's folder is gone or its mrepo's runtime has ended.
//   --dir=<the mrepo's folder>   where its state is written
//   --outbox=<folder>            the records it follows
//   --root=<unique URI>          the mrepo whose outbox that is: local/boot when none
//   --port=<n>                   4400 when none; another when it is taken
//   --runtime=<pid>              the mrepo's runtime: ended with it
export async function program (argv) {
  const arg = name => argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const dir = arg('dir')
  const outbox = arg('outbox')
  if (!dir || !outbox) throw new Error('--dir=<the mrepo\'s folder> --outbox=<the folder to follow> [--root=<unique URI>] [--port=<n>] [--runtime=<pid>]')
  const runtime = arg('runtime') ? Number(arg('runtime')) : null
  const s = await serve({ outbox, dir, root: arg('root') ?? ROOT, port: arg('port') === undefined ? PORT : Number(arg('port')) })
  // its state, written whole and renamed into place
  const file = join(dir, STATE)
  writeFileSync(`${file}.new`, JSON.stringify({ pid: process.pid, url: s.url, port: s.port, outbox, root: s.root, started: new Date().toISOString() }) + '\n')
  renameSync(`${file}.new`, file)
  let closing = null
  const close = () => (closing ??= s.close().then(() => rmSync(file, { force: true })))
  await new Promise(resolve => {
    const end = () => close().then(resolve)
    process.on('SIGTERM', end)
    process.on('SIGINT', end)
    // ended with its mrepo: the folder gone, or its runtime
    const t = setInterval(() => { if (!existsSync(dir) || (runtime && !alive(runtime))) { clearInterval(t); end() } }, 250)
  })
}

// The program started as its own process, through the shell (it outlives
// the caller), and waited for until it has written its state. -> its
// state; null when it did not come up.
//   program   what Bare is started with: the package's bundle, or cli.js
export async function launch ({ program: file, dir, outbox, root = ROOT, port = PORT, runtime = null, bare = process.execPath, wait = 10000 }) {
  const args = [file, `--dir=${dir}`, `--outbox=${outbox}`, `--root=${root}`, `--port=${port}`, ...(runtime ? [`--runtime=${runtime}`] : [])]
  rmSync(join(dir, STATE), { force: true })
  const r = spawnSync('sh', ['-c', 'if command -v setsid >/dev/null 2>&1; then setsid "$@" </dev/null >/dev/null 2>&1 & else "$@" </dev/null >/dev/null 2>&1 & fi', 'sh', bare, ...args], { stdio: 'ignore' })
  if (r.status !== 0) return null
  // time: the wait for its state, bounded
  for (const until = Date.now() + wait; Date.now() < until;) {
    await pause(100)
    const s = stateOf(dir)
    if (s) return s
  }
  return null
}

// The server ended, waited for until its process has ended: SIGTERM, then
// SIGKILL. -> { pid, how }; null when none was running.
export async function end (dir, { wait = 5000 } = {}) {
  const s = stateOf(dir)
  if (!s) { rmSync(join(dir, STATE), { force: true }); return null }
  const ended = async ms => { for (let i = 0; i < ms / 50 && alive(s.pid); i++) await pause(50); return !alive(s.pid) }
  let how = 'SIGTERM'
  // catch: ended meanwhile: nothing to signal
  try { os.kill(s.pid, 'SIGTERM') } catch {}
  if (!await ended(wait)) {
    how = 'SIGKILL'
    // catch: ended meanwhile: nothing to signal
    try { os.kill(s.pid, 'SIGKILL') } catch {}
    if (!await ended(2000)) throw new Error(`its server did not end: pid ${s.pid}`)
  }
  rmSync(join(dir, STATE), { force: true })
  return { pid: s.pid, how }
}
