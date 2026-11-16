// Splectral's server: a record summed up, a folder of records followed,
// the server asked over HTTP, the program started as its own process and
// ended, the protocol's actions on a minimal execution. The records are
// written here, as an outbox folder holds them.
import test from 'brittle'
import http from 'bare-http1'
import process from 'bare-process'
import os from 'bare-os'
import { spawn } from 'bare-subprocess'
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync, existsSync } from 'bare-fs'
import { join, dirname } from 'bare-path'
import { tmpdir } from 'bare-os'
import { fileURLToPath } from 'bare-url'
import { summaryOf, follow, serve, launch, end, stateOf, start, stop, status, PAGE, CONFIG, PORT, HOST, STATE } from '../index.js'

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.js')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async (ok, ms = 5000) => { for (let i = 0; i < ms / 50; i++) { if (await ok()) return true; await wait(50) } return false }
// catch: no such process: not alive
const alive = pid => { try { os.kill(pid, 0); return true } catch { return false } }

// A completed record as an outbox folder holds it: its envelope, the
// record as sent, its completed form.
const KEYS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']
function record (n, { command = ['haicc', 'host', 'crud/read', '.'], sent = `2026-11-16T10:00:0${n}.000Z`, done = `2026-11-16T10:00:0${n}.250Z`, error = null, log = null } = {}) {
  const form = { command, protocol: 'haicc', action: 'goto', uri: ['main', 'host'], args: command.slice(2), log: log ?? [{ level: 'info', event: 'request.sent', to: 'host', mrepo: 'local/host' }, { level: 'info', event: 'request.metrics', ok: true, ms: 12 }], ...(error ? { error } : { output: [] }) }
  return { topic: '/outbox', key: KEYS[n], timestamp: done, headers: {}, value: { topic: '/haicc/terminal', key: KEYS[n], timestamp: sent, headers: {}, value: form } }
}
// (written whole, renamed into place, as an mrepo writes its outbox folder)
function drop (folder, rec) {
  writeFileSync(join(folder, `${rec.key}.tmp`), JSON.stringify(rec))
  renameSync(join(folder, `${rec.key}.tmp`), join(folder, `${rec.key}.json`))
}
const ask = (url, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request(url, { method }, res => { let body = ''; res.on('data', d => { body += d }); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body })) })
  req.on('error', reject)
  req.end()
})

test('a completed record summed up in a line', (t) => {
  const line = summaryOf(record(1, { command: ['haicc', 'host', 'haicc', 'swarms/swarm-1/node-1', 'crud/create', 'notes'], log: [{ event: 'request.sent', mrepo: 'local/host' }, { event: 'request.sent', mrepo: 'swarm-1/node-1', jump: ['host'] }, { event: 'request.changed', target: 'main', count: 2, jump: ['host', 'swarms/swarm-1/node-1'] }, { event: 'request.changed', target: 'help', count: 3 }] }))
  t.alike(line, { key: KEYS[1], sent: '2026-11-16T10:00:01.000Z', done: '2026-11-16T10:00:01.250Z', ms: 250, from: '/haicc/terminal', command: 'haicc host haicc swarms/swarm-1/node-1 crud/create notes', ok: true, error: null, through: ['local/host', 'swarm-1/node-1'], changed: 5 }, 'its key, when it was sent and completed and the time between, who asked, the command as typed, its result, the mrepos it was sent on to in order, how much it changed')
  const failed = summaryOf(record(2, { error: 'not now: service start (the service is started)' }))
  t.alike([failed.ok, failed.error], [false, 'not now: service start (the service is started)'], 'one that failed: not ok, what it said')
  t.alike(summaryOf(record(3, { log: [] })).through, [], 'sent on nowhere: executed where it arrived')
  t.is(summaryOf({ mode: 'atomic', description: 'a layer' }), null, 'a layer\'s own config: no record')
  t.is(summaryOf({ topic: '/inbox', key: KEYS[0], timestamp: 'x', value: { topic: '/t', key: KEYS[0], timestamp: 'x', value: ['crud/read', '.'] } }), null, 'a record not completed, its parts as typed: none')
  t.is(summaryOf(null), null)
})

test('a folder of records followed: what is there, the oldest first; then each that arrives, once', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'splectral-follow-'))
  try {
    drop(folder, record(2))
    drop(folder, record(1))
    writeFileSync(join(folder, 'layer.json'), JSON.stringify({ mode: 'atomic' }))
    const got = []
    const f = follow(folder, (envelope, file) => got.push([envelope.key ?? 'layer', file]), { every: 100 })
    t.alike(got.map(g => g[0]), [KEYS[1], KEYS[2], 'layer'], 'what is there, by when each was completed (a file without a time last)')
    drop(folder, record(3))
    t.ok(await until(() => got.length === 4), 'a record that arrives: taken')
    t.alike(got[3], [KEYS[3], `${KEYS[3]}.json`], 'with its file')
    writeFileSync(join(folder, 'half.json'), '{"topic":')
    await wait(300)
    t.is(got.length, 4, 'a file that is not whole: not taken')
    writeFileSync(join(folder, 'half.json'), JSON.stringify(record(0)))
    t.ok(await until(() => got.length === 5), 'whole now: taken')
    await wait(300)
    t.is(got.length, 5, 'each once')
    f.stop()
    drop(folder, { ...record(1), key: '55555555-5555-4555-8555-555555555555' })
    await wait(300)
    t.is(got.length, 5, 'stopped: nothing more')
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('the server: the page, the lines, one record whole, each new line streamed; closed', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'splectral-serve-'))
  let s = null
  let second = null
  try {
    drop(folder, record(1))
    drop(folder, record(2, { error: 'no node there' }))
    s = await serve({ outbox: folder, port: 0, every: 100 })
    t.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(s.url) && s.port > 0, 'served on this machine only, at a free port when 0 is asked')
    const page = await ask(`${s.url}/`)
    t.alike([page.status, page.type, page.body === PAGE, page.body.includes('<title>Splectral</title>')], [200, 'text/html; charset=utf-8', true, true], 'the page')
    t.absent(/src="http|href="http|@import/.test(PAGE), 'nothing loaded from elsewhere')
    const all = JSON.parse((await ask(`${s.url}/records`)).body)
    t.alike([all.outbox, all.records.map(l => [l.key, l.ok])], [folder, [[KEYS[1], true], [KEYS[2], false]]], 'the lines so far, the oldest first, and the folder they come from')
    t.alike(JSON.parse((await ask(`${s.url}/record/${KEYS[2]}`)).body), record(2, { error: 'no node there' }), 'one record whole, as its folder holds it')
    t.alike([(await ask(`${s.url}/record/${KEYS[3]}`)).status, (await ask(`${s.url}/record/..%2Flayer`)).status, (await ask(`${s.url}/nothing`)).status, (await ask(`${s.url}/records`, 'POST')).status], [404, 404, 404, 405], 'a record it does not hold, a path that is no key, nothing there: 404; another method: 405')
    // the stream: a line for each record that arrives
    const lines = []
    const stream = http.request(`${s.url}/stream`, res => { res.on('data', d => { for (const l of d.toString().split('\n')) if (l.startsWith('data: ')) lines.push(JSON.parse(l.slice(6))) }) })
    stream.on('error', () => {})
    stream.end()
    t.ok(await until(() => s.clients() === 1), 'a stream open')
    drop(folder, record(3, { command: ['boot/deploy', 'host', 'base-component-haicc'], log: [] }))
    t.ok(await until(() => lines.length === 1), 'a record arrives: its line streamed')
    t.alike([lines[0].key, lines[0].command, lines[0].through], [KEYS[3], 'boot/deploy host base-component-haicc', []], 'the line')
    t.is(s.records().length, 3, 'and among the lines')
    // the port taken: another, unless that is not wanted
    second = await serve({ outbox: folder, port: s.port })
    t.ok(second.port !== s.port && second.port > 0, 'a port that is taken: a free one instead')
    await t.exception(serve({ outbox: folder, port: s.port, other: false }), /not served at 127\.0\.0\.1:\d+/, 'or refused, when no other is wanted')
    await s.close()
    t.ok(await ask(`${s.url}/records`).then(() => false, () => true), 'closed: not answering')
    s = null
    t.alike([PORT, HOST], [4400, '127.0.0.1'], 'where it is served when nothing is said')
  } finally {
    if (s) await s.close()
    if (second) await second.close()
    rmSync(folder, { recursive: true, force: true })
  }
})

test('the program as its own process: started, its state, answering; ended; ended by itself with its runtime, and with its folder', { timeout: 60000 }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'splectral-process-'))
  const outbox = join(work, 'outbox')
  const dir = join(work, 'mrepo')
  mkdirSync(outbox)
  mkdirSync(dir)
  try {
    drop(outbox, record(1))
    t.is(stateOf(dir), null, 'nothing started: no state')
    t.is(await end(dir), null, 'nothing to end')
    const s = await launch({ program: CLI, dir, outbox, port: 0 })
    t.ok(s?.pid && s.pid !== process.pid && alive(s.pid), 'started: its own process')
    t.alike([Object.keys(s), s.outbox, s.url === `http://127.0.0.1:${s.port}`], [['pid', 'url', 'port', 'outbox', 'started'], outbox, true], 'its state, written into the mrepo\'s folder when it listens')
    t.alike(stateOf(dir), s, 'read back')
    t.is(JSON.parse((await ask(`${s.url}/records`)).body).records.length, 1, 'answering: the record there')
    t.alike(await end(dir), { pid: s.pid, how: 'SIGTERM' }, 'ended: asked, and waited for')
    t.alike([alive(s.pid), existsSync(join(dir, STATE)), stateOf(dir)], [false, false, null], 'its process gone, its state removed')
    // a state left by a process that is gone: none
    writeFileSync(join(dir, STATE), JSON.stringify({ ...s }))
    t.is(stateOf(dir), null, 'a state whose process is gone: not running')
    // ended with its runtime: the process it was given
    const runtime = spawn('sh', ['-c', 'sleep 2'], { stdio: 'ignore' })
    const withRuntime = await launch({ program: CLI, dir, outbox, port: 0, runtime: runtime.pid })
    t.ok(withRuntime && alive(withRuntime.pid), 'started with a runtime to end with')
    t.ok(await until(() => !alive(withRuntime.pid), 8000), 'its runtime ended: it ends by itself')
    t.absent(existsSync(join(dir, STATE)), 'its state removed')
    // ended with its mrepo's folder
    const withFolder = await launch({ program: CLI, dir, outbox, port: 0 })
    rmSync(dir, { recursive: true, force: true })
    t.ok(await until(() => !alive(withFolder.pid), 8000), 'its mrepo\'s folder gone: it ends by itself')
  } finally {
    const left = existsSync(dir) ? stateOf(dir) : null
    // catch: ended meanwhile: nothing to signal
    if (left) try { os.kill(left.pid, 'SIGKILL') } catch {}
    rmSync(work, { recursive: true, force: true })
  }
})

// An execution as an action sees it: the mrepo it runs in, its log kept.
function execution (runtime) {
  return {
    runtime,
    log: function (level, event, data = {}) { (this.entries ??= []).push({ level, event, ...data }) },
    step: async function (event, data, fn, level = 'verbose') { const r = await fn(); (this.entries ??= []).push({ level, event, ...(typeof data === 'function' ? data(r) : data) }); return r }
  }
}

test('the actions: start, status, stop; what start refuses', { timeout: 60000 }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'splectral-actions-'))
  const dir = join(work, 'mrepos', 'local', 'splectral')
  const outbox = join(work, 'mrepos', 'boot', 'outbox')
  mkdirSync(dir, { recursive: true })
  try {
    const exec = execution({ dir, work })
    t.alike(await status(exec), { running: false }, 'status, nothing started: not running')
    t.alike(await stop(exec), { splectral: 'stopped', pid: null }, 'stop, nothing running: no error')
    await t.exception(start(exec, { args: ['web'] }), /not a port: web/)
    await t.exception(start(exec, { args: ['70000'] }), /not a port: 70000/)
    await t.exception(start(execution({ dir, work: null }), {}), /no work folder in the context: no root mrepo to follow/)
    await t.exception(start(execution({ dir: null, work }), {}), /no directory in the context/)
    // the root mrepo: the one the work folder's setting names
    writeFileSync(join(work, 'mrepo.json'), JSON.stringify({ storage: 'filesystem', name: 'boot' }))
    await t.exception(start(exec, {}), /nothing to follow: .*mrepos\/boot\/outbox \(the root mrepo's outbox folder\)/, 'the root mrepo has no outbox folder')
    mkdirSync(outbox, { recursive: true })
    drop(outbox, record(1))
    await t.exception(start(exec, {}), /no server to start: haiccing\/base-package-splectral is not among the mrepo's packages/, 'the package\'s bundle not in the mrepo\'s packages')
    t.is(stateOf(dir), null, 'nothing started by any of it')
    exec.entries = []
    const s = await start(exec, { args: ['0'] }, { program: CLI })
    t.alike([s.splectral, s.outbox, /^http:\/\/127\.0\.0\.1:\d+$/.test(s.url), alive(s.pid)], ['started', outbox, true, true], 'start: its server running, following the root mrepo\'s outbox folder; where the page is')
    t.alike(exec.entries.map(e => [e.level, e.event]), [['verbose', 'server'], ['info', 'started']], 'its step at verbose, what it did at info')
    t.is(JSON.parse((await ask(`${s.url}/records`)).body).records[0].key, KEYS[1], 'the page\'s lines: the root\'s records')
    t.alike(await start(exec, {}, { program: CLI }), s, 'start again: running already, left as it is')
    const st = await status(exec)
    t.alike([st.running, st.url, st.pid, st.outbox, typeof st.started], [true, s.url, s.pid, outbox, 'string'], 'status: running, where, what it follows, since when')
    t.alike(await stop(exec), { splectral: 'stopped', pid: s.pid }, 'stop: its process ended')
    t.alike([alive(s.pid), await status(exec)], [false, { running: false }], 'gone; not running')
  } finally {
    const left = stateOf(dir)
    // catch: ended meanwhile: nothing to signal
    if (left) try { os.kill(left.pid, 'SIGKILL') } catch {}
    rmSync(work, { recursive: true, force: true })
  }
})

test('the config: start, stop and status, each at the mrepo itself', (t) => {
  t.alike(Object.keys(CONFIG.actions), ['start', 'stop', 'status'])
  for (const [name, a] of Object.entries(CONFIG.actions)) {
    t.alike(a.uris, ['.'], `${name}: at the mrepo itself`)
    t.ok(a.description, `${name}: described`)
  }
  t.alike([CONFIG.actions.start.args, 'args' in CONFIG.actions.stop, 'args' in CONFIG.actions.status], [['port?'], false, false], 'start: its port, optional; the others none')
})
