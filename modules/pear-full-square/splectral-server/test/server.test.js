// Splectral's server: a record summed up, a folder of records followed,
// the server asked over HTTP, the program started as its own process and
// ended, the protocol's actions on a minimal execution. The records are
// written here, as an outbox folder holds them.
import test from 'brittle'
import http from 'bare-http1'
import process from 'bare-process'
import os from 'bare-os'
import { spawn } from 'bare-subprocess'
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync, existsSync, readFileSync, readdirSync } from 'bare-fs'
import { join, dirname } from 'bare-path'
import { tmpdir } from 'bare-os'
import { streamOf } from 'mrepo-base-request'
import { fileURLToPath } from 'bare-url'
import { summaryOf, follow, followStream, serve, mreposOf, createStructure, launch, end, stateOf, start, stop, status, PAGE, site, SHOWN, PORT, HOST, ROOT, STATE, SIDE, COMPONENTS } from '../index.js'

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.js')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async (ok, ms = 5000) => { for (let i = 0; i < ms / 50; i++) { if (await ok()) return true; await wait(50) } return false }
// catch: no such process: not alive
const alive = pid => { try { os.kill(pid, 0); return true } catch { return false } }

// A completed record as an outbox folder holds it: its envelope, the
// record as sent, its completed form.
// (its offset: its identity, its name in the folder, 13 digits)
const KEYS = ['1795312345600', '1795312345601', '1795312345602', '1795312345603']
function record (n, { command = ['haicc', 'host', 'crud/read', '.'], sent = `2026-11-16T10:00:0${n}.000Z`, done = `2026-11-16T10:00:0${n}.250Z`, error = null, log = null } = {}) {
  const form = { command, protocol: 'haicc', action: 'goto', uri: ['main', 'host'], args: command.slice(2), log: log ?? [{ level: 'info', event: 'request.sent', to: 'host', mrepo: 'local/host' }, { level: 'info', event: 'request.metrics', ok: true, ms: 12 }], ...(error ? { error } : { output: [] }) }
  return { topic: '/outbox', offset: Number(KEYS[n]), timestamp: done, headers: {}, value: { topic: '/haicc/terminal', offset: Number(KEYS[n]), timestamp: sent, headers: {}, value: form } }
}
// (written whole, renamed into place, as an mrepo writes its outbox folder)
// into an outbox, a streaming folder: under its offset, in its buckets
const drop = (folder, rec) => streamOf(folder).put(rec.offset, rec)
// into a queue beside an mrepo (a component's side box): a keyed record, flat
const keyed = n => ({ ...record(n), key: KEYS[n] })
function queue (folder, rec) {
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
    queue(folder, keyed(2))
    queue(folder, keyed(1))
    writeFileSync(join(folder, '.layer.json'), JSON.stringify({ mode: 'atomic' }))
    const got = []
    const f = follow(folder, (envelope, file) => got.push([envelope.key ?? 'layer', file]), { every: 100 })
    t.alike(got.map(g => g[0]), [KEYS[1], KEYS[2], 'layer'], 'what is there, by when each was completed (a file without a time last)')
    queue(folder, keyed(3))
    t.ok(await until(() => got.length === 4), 'a record that arrives: taken')
    t.alike(got[3], [KEYS[3], `${KEYS[3]}.json`], 'with its file')
    writeFileSync(join(folder, 'half.json'), '{"topic":')
    await wait(300)
    t.is(got.length, 4, 'a file that is not whole: not taken')
    writeFileSync(join(folder, 'half.json'), JSON.stringify(keyed(0)))
    t.ok(await until(() => got.length === 5), 'whole now: taken')
    await wait(300)
    t.is(got.length, 5, 'each once')
    f.stop()
    queue(folder, { ...record(1), key: '55555555-5555-4555-8555-555555555555' })
    await wait(300)
    t.is(got.length, 5, 'stopped: nothing more')
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

// A completed record with an output, sent on through the mrepos given.
let n = 0
function done (through, output, error = null) {
  const offset = 1795312346000 + (++n)
  const form = { command: ['x'], log: through.map(mrepo => ({ event: 'request.sent', mrepo })), ...(error ? { error } : { output }) }
  return { topic: '/outbox', offset, timestamp: `2026-11-16T11:00:${String(n).padStart(2, '0')}.000Z`, headers: {}, value: { topic: '/haicc/terminal', offset, timestamp: `2026-11-16T11:00:${String(n).padStart(2, '0')}.000Z`, headers: {}, value: form } }
}

test('the install folded from its completed records: its mrepos a tree, each with its state; a swarm node one node, its container part of it', (t) => {
  const s = createStructure('local/boot')
  const at = uri => s.snapshot().nodes.find(x => x.uri === uri) ?? null
  t.alike(s.snapshot(), { root: 'local/boot', version: 0, nodes: [{ uri: 'local/boot', parent: null, at: '.', package: null, service: null, container: null, depth: 0 }] }, 'nothing yet: the root alone')
  t.is(s.apply(done([], { deployed: 'host', mrepo: 'local/host', package: 'haiccing/base-component-haicc' })), 'local/host', 'a deploy executed at the root: a child of the root, by its unique URI; what changed said')
  t.alike(at('local/host'), { uri: 'local/host', parent: 'local/boot', at: 'host', package: 'haiccing/base-component-haicc', service: null, container: null, depth: 1 }, 'the node: its parent, its position, its package; no state yet')
  s.apply(done(['local/host'], { service: 'initialised', state: 'initialised' }))
  t.is(at('local/host').service, 'initialised', 'a service command sent on to it: its state')
  s.apply(done(['local/host'], { service: 'started', state: 'started' }))
  t.is(s.apply(done(['local/host'], [{ uri: ['main', 'swarms'], value: {}, children: ['swarm-1'], outcome: 'created' }])), null, 'a command that says nothing of the structure: nothing changed')
  s.apply(done(['local/host'], { deployed: 'swarms/swarm-1/node-1', mrepo: 'swarm-1/node-1', package: 'haiccing/base-component-haicc' }))
  s.apply(done(['local/host'], { deployed: 'swarms/swarm-1/node-2', mrepo: 'swarm-1/node-2', package: 'haiccing/base-component-haicc' }))
  t.alike(s.snapshot().nodes.map(x => [x.depth, x.uri, x.parent]), [[0, 'local/boot', null], [1, 'local/host', 'local/boot'], [2, 'swarm-1/node-1', 'local/host'], [2, 'swarm-1/node-2', 'local/host']], 'the tree: each parent before its children, the children by position')
  t.is(s.snapshot().version, 5, 'its version: one a change (the deploys, the service moved twice), none for what changed nothing')
  t.alike(mreposOf(s.snapshot()), { version: 5, mrepos: [{ at: '.', depth: 0, package: null }, { at: 'host', depth: 1, package: 'haiccing/base-component-haicc' }, { at: 'host/swarms/swarm-1/node-1', depth: 2, package: 'haiccing/base-component-haicc' }, { at: 'host/swarms/swarm-1/node-2', depth: 2, package: 'haiccing/base-component-haicc' }] }, 'the mrepos as a command names them: each by its position from the root')
  s.apply(done(['local/host', 'swarm-1/node-1'], { service: 'started', state: 'started' }))
  // its container: a swarm node is one node
  t.is(s.apply(done(['local/host', 'swarm-1/node-1'], { created: 'container', mrepo: 'swarm-1/node-1/container', container: { name: 'haicc-swarm-1-node-1-abc', image: 'haicc-node:x' } })), 'swarm-1/node-1', 'its replica made: the node changed, no node of its own')
  t.alike(at('swarm-1/node-1').container, { name: 'haicc-swarm-1-node-1-abc', state: 'created', service: null }, 'the node\'s container: made')
  s.apply(done(['local/host', 'swarm-1/node-1'], { started: 'container', container: 'haicc-swarm-1-node-1-abc', state: 'running' }))
  s.apply(done(['local/host', 'swarm-1/node-2'], { started: 'container', container: 'haicc-swarm-1-node-2-abc', state: 'running', service: 'started' }))
  t.is(at('swarm-1/node-2').container?.service, 'started', 'a container started, its replica\'s service said with it (its commission done): that state')
  t.is(s.apply(done(['local/host', 'swarm-1/node-1', 'swarm-1/node-1/container'], { service: 'started', state: 'started' })), 'swarm-1/node-1', 'a service command executed in the replica: its node changed')
  t.alike([at('swarm-1/node-1').service, at('swarm-1/node-1').container, s.snapshot().nodes.length], ['started', { name: 'haicc-swarm-1-node-1-abc', state: 'running', service: 'started' }, 4], 'the node: its own state, its container running with the replica\'s state; four nodes still')
  t.is(s.apply(done(['local/host', 'swarm-1/node-1', 'swarm-1/node-1/container'], { deployed: 'x', mrepo: 'swarm-1/x' })), null, 'a deploy inside a replica: not shown')
  s.apply(done(['local/host', 'swarm-1/node-1'], { stopped: 'container', container: 'haicc-swarm-1-node-1-abc', state: 'exited' }))
  t.alike(at('swarm-1/node-1').container, { name: 'haicc-swarm-1-node-1-abc', state: 'exited', service: null }, 'stopped: exited, its replica\'s state not known any more')
  s.apply(done(['local/host', 'swarm-1/node-1'], { replica: 'container', mrepo: 'swarm-1/node-1/container', container: 'haicc-swarm-1-node-1-abc', image: 'i', state: 'running' }))
  t.is(at('swarm-1/node-1').container.state, 'running', 'a status asked: what it says')
  s.apply(done(['local/host', 'swarm-1/node-1'], { removed: 'container', container: 'haicc-swarm-1-node-1-abc' }))
  t.is(at('swarm-1/node-1').container, null, 'removed: no container')
  // what changes nothing
  t.is(s.apply(done(['local/host'], null, 'not now: service start (the service is started)')), null, 'a command that failed: nothing changed')
  t.is(s.apply(done(['local/elsewhere'], { service: 'started', state: 'started' })), null, 'executed in an mrepo it does not know: nothing')
  t.is(s.apply({ mode: 'atomic' }), null, 'no record: nothing')
  // torn down: the node and what was below it
  t.is(s.apply(done([], { deployed: 'splectral', mrepo: 'local/splectral', package: 'haiccing/base-package-splectral', commission: 'done', service: 'started' })), 'local/splectral')
  t.is(at('local/splectral').service, 'started', 'a deploy that says its service state, its commission done: that state')
  t.is(s.apply(done([], { tornDown: 'host' })), 'local/boot', 'a teardown executed at the root: its child gone; the root changed')
  t.alike(s.snapshot().nodes.map(x => x.uri), ['local/boot', 'local/splectral'], 'the host and the nodes below it gone')
  t.alike([s.apply(done([], [{ tornDown: 'splectral' }, { tornDown: 'nothing' }])), s.snapshot().nodes.length], ['local/boot', 1], 'several torn down at once: a list, each taken')
  // deployed again at a position: the one that was there replaced
  s.apply(done([], { deployed: 'host', mrepo: 'local/host', package: 'a' }))
  s.apply(done(['local/host'], { service: 'started', state: 'started' }))
  s.apply(done([], { tornDown: 'host', deployed: 'host', mrepo: 'local/host', package: 'b' }))
  t.alike([at('local/host').package, at('local/host').service], ['b', null], 'a redeploy: the node new, its state gone')
})

test('the site: its tabs, Splectral\'s own first; a section\'s page embedded in its content area, its links at the top; the rest in a drop-down; static', (t) => {
  const tabs = [{ name: 'install', label: 'install', href: '/install' }, { name: 'help', label: 'help', href: '/help/' }]
  const html = site({ tabs, selected: 'help', content: '<!doctype html><html><head><title>x</title></head><body><a href="/help/x">"x" & y</a></body></html>' })
  t.ok(html.includes('<title>Splectral · help</title>'), 'the site, the section shown')
  t.ok(html.includes('<a href="/install">install</a><a href="/help/" class="on" aria-current="page">help</a>'), 'its tabs, a component\'s at its own URI, the one shown marked')
  t.ok(html.includes('srcdoc="<!doctype html><html><head><base href=&quot;/help/&quot; target=&quot;_top&quot;><title>x</title></head><body><a href=&quot;/help/x&quot;>&quot;x&quot; &amp; y</a></body></html>"'), 'the section\'s page embedded whole, its base its section\'s address, its links opening at the top')
  t.ok(site({ tabs, selected: 'nothing' }).includes('<a href="/install" class="on"'), 'none there: the first')
  t.absent(/<script\b/.test(html), 'static: no script of its own')
  t.absent(html.includes('<details'), 'few tabs: no drop-down')
  const many = [tabs[0], ...Array.from({ length: SHOWN + 1 }, (_, i) => ({ name: `c${i}`, label: `c${i}`, href: `/c${i}/` }))]
  const crowded = site({ tabs: many, selected: `c${SHOWN}` })
  t.is((crowded.match(/<nav>.*<details/)[0].match(/<a /g) ?? []).length, SHOWN, 'the first five shown')
  t.ok(crowded.includes('<details open><summary>more (2)</summary>'), 'the rest in a drop-down, open when the one shown is in it')
  t.exception(() => site({ tabs: [] }), /missing argument: tabs/)
})

test('the server: the site, its own page, the lines, one record whole, each new line streamed; closed', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'splectral-serve-'))
  let s = null
  let second = null
  try {
    drop(folder, record(1))
    drop(folder, record(2, { error: 'no node there' }))
    s = await serve({ outbox: folder, port: 0, every: 100 })
    t.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(s.url) && s.port > 0, 'served on this machine only, at a free port when 0 is asked')
    const front = await ask(`${s.url}/`)
    const own = site({ tabs: [{ name: 'install', label: 'install', href: '/install' }], selected: 'install', content: PAGE })
    t.alike([front.status, front.type, front.body === own], [200, 'text/html; charset=utf-8', true], 'the site, its own page in it')
    t.is((await ask(`${s.url}/install`)).body, own, 'the same at /install')
    t.ok(PAGE.includes('<title>Splectral</title>'), 'its own page')
    t.absent(/src="http|href="http|@import/.test(PAGE), 'nothing loaded from elsewhere')
    // its script reads as JavaScript: made a function, not run
    const script = PAGE.slice(PAGE.indexOf('<script>') + '<script>'.length, PAGE.indexOf('</script>'))
    t.execution(() => new Function(script), 'the page\'s script reads as JavaScript')
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
    drop(folder, record(3, { command: ['boot/deploy', 'host', 'haiccing/base-component-haicc'], log: [] }))
    t.ok(await until(() => lines.length === 1), 'a record arrives: its line streamed')
    t.alike([lines[0].key, lines[0].command, lines[0].through], [KEYS[3], 'boot/deploy host haiccing/base-component-haicc', []], 'the line')
    t.is(s.records().length, 3, 'and among the lines')
    // the structure: folded from the records, asked for, and streamed when one changes it
    t.alike([s.root, ROOT, JSON.parse((await ask(`${s.url}/structure`)).body)], ['local/boot', 'local/boot', { root: 'local/boot', version: 0, nodes: [{ uri: 'local/boot', parent: null, at: '.', package: null, service: null, container: null, depth: 0 }] }], 'the structure asked for: the root alone, no record having said more')
    const structures = []
    const second2 = http.request(`${s.url}/stream`, res => { let buf = ''; res.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n\n')) >= 0) { const block = buf.slice(0, i); buf = buf.slice(i + 2); if (block.startsWith('event: structure\n')) structures.push(JSON.parse(block.slice(block.indexOf('data: ') + 6))) } }) })
    second2.on('error', () => {})
    second2.end()
    t.ok(await until(() => s.clients() === 2), 'a second stream open')
    const deployed = record(0, { command: ['boot/deploy', 'host', 'haiccing/base-component-haicc'], log: [], done: '2026-11-16T10:00:09.000Z' })
    deployed.value.value.output = { deployed: 'host', mrepo: 'local/host', package: 'haiccing/base-component-haicc' }
    // (arrived after the others: an offset past theirs)
    deployed.offset = deployed.value.offset = Number(KEYS[3]) + 1
    drop(folder, deployed)
    t.ok(await until(() => structures.length === 1), 'a record that changes the structure: the structure streamed, an event of its own')
    t.alike([structures[0].changed, structures[0].nodes.map(x => x.uri)], ['local/host', ['local/boot', 'local/host']], 'what changed, and the tree now')
    t.alike(s.structure().nodes.map(x => x.uri), ['local/boot', 'local/host'], 'and asked of the server itself')
    t.is(lines.filter(l => l.key).length, 2, 'its line streamed as any other')
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
    t.alike([Object.keys(s), s.outbox, s.url === `http://127.0.0.1:${s.port}`], [['pid', 'url', 'port', 'outbox', 'root', 'started'], outbox, true], 'its state, written into the mrepo\'s folder when it listens')
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
    const exec = execution({ dir, work, uri: 'local/splectral' })
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
    t.is(stateOf(dir).root, 'local/boot', 'the root it was given: the mrepo the work folder\'s setting names, in this mrepo\'s swarm')
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


test('a component: a page asked through its Splectral inbox, its data request run through the root mrepo\'s inbox, the page served; an mrepo by its unique URI resolved, kept; one not answering; one not running', { timeout: 60000 }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'splectral-components-'))
  const boot = join(work, 'mrepos', 'boot')
  const dir = join(work, 'mrepos', 'local', 'splectral')
  const viewer = join(work, 'mrepos', 'local', 'viewer')
  for (const f of [join(boot, 'inbox'), join(boot, 'outbox'), dir, join(viewer, SIDE, 'inbox'), join(viewer, SIDE, 'outbox')]) mkdirSync(f, { recursive: true })
  const put = (folder, key, value) => { writeFileSync(join(folder, `${key}.json.new`), JSON.stringify(value)); renameSync(join(folder, `${key}.json.new`), join(folder, `${key}.json`)) }
  // the root mrepo, as far as the test goes: a command in, its completed form out
  const asked = []
  const root = followStream(join(boot, 'inbox'), (envelope) => {
    const core = envelope.value
    asked.push({ topic: envelope.topic, parts: core.value, trigger: core.headers.trigger })
    // (the registry consulted: haicc/mrepos <xpath>, its mrepos and where they are)
    const output = core.value[0] === 'haicc/mrepos' ? [{ uri: 'local/docs', position: 'workbench/docs', package: 'haiccing/base-component-docs', running: true }, { uri: 'local/lost', position: null, package: null, running: false }].filter(m => m.uri === core.value[1]) : { page: '# Validation\n\nBefore every commit.' }
    streamOf(join(boot, 'outbox')).put(core.offset, { topic: core.topic, offset: core.offset, timestamp: new Date().toISOString(), headers: {}, value: { ...core, value: { command: core.value, output } } })
  }, { every: 200 })
  // the component's renderer, as far as the test goes: a page asked, data asked for it, the page answered
  const pages = []
  const answered = { records: [], mrepos: [], mrepo: [] }
  // its data request's key, the page's with its first digit changed: never the page's own (a key seen once in a folder is not taken again)
  const dataKey = key => `${key[0] === 'd' ? 'e' : 'd'}${key.slice(1)}`
  const renderer = follow(join(viewer, SIDE, 'inbox'), (envelope, file) => {
    const form = envelope.value.value
    rmSync(join(viewer, SIDE, 'inbox', file), { force: true })
    if (form.request === 'page') {
      pages.push({ ...form, key: envelope.key })
      put(join(viewer, SIDE, 'outbox'), dataKey(envelope.key), { topic: '/splectral', key: dataKey(envelope.key), timestamp: new Date().toISOString(), headers: { page: envelope.key }, value: { topic: '/local/viewer/splectral/inbox', key: dataKey(envelope.key), timestamp: new Date().toISOString(), headers: {}, value: { request: 'data', at: 'docs', command: ['info/get', form.path], raw: true } } })
    } else if (form.request === 'mrepos') {
      answered.mrepos.push(form.output)
    } else if (form.request === 'mrepo') {
      answered.mrepo.push('error' in form ? { error: form.error } : form.output)
    } else if (form.request === 'data') {
      answered.records.push(form.record)
      const key = pages.at(-1).key
      put(join(viewer, SIDE, 'outbox'), key, { topic: '/splectral', key, timestamp: new Date().toISOString(), headers: {}, value: { topic: '/splectral', key, timestamp: new Date().toISOString(), headers: {}, value: { request: 'page', path: pages.at(-1).path, output: `<h1>${form.output.page.split('\n')[0].slice(2)}</h1>` } } })
    }
  }, { every: 200 })
  mkdirSync(join(dir, COMPONENTS), { recursive: true })
  // their renderers' state, as runtime/start leaves it: the viewer's and the quiet one's running (this process), the stopped one's none
  const running = (folder) => { mkdirSync(join(folder, SIDE, 'packages', 'splectral'), { recursive: true }); writeFileSync(join(folder, SIDE, 'packages', 'splectral', 'r.state.json'), JSON.stringify({ pid: Bare.pid })) }
  running(viewer)
  writeFileSync(join(dir, COMPONENTS, 'viewer.json'), JSON.stringify({ at: 'viewer', mrepo: 'local/viewer', folder: viewer, component: 'splectral/base-component-help-viewer', list: ['splectral/r'], installed: 'now' }))
  writeFileSync(join(dir, COMPONENTS, 'quiet.json'), JSON.stringify({ at: 'quiet', mrepo: 'local/quiet', folder: join(work, 'mrepos', 'local', 'quiet'), component: 'splectral/x', list: ['splectral/r'], installed: 'now' }))
  mkdirSync(join(work, 'mrepos', 'local', 'quiet', SIDE, 'outbox'), { recursive: true })
  running(join(work, 'mrepos', 'local', 'quiet'))
  writeFileSync(join(dir, COMPONENTS, 'stopped.json'), JSON.stringify({ at: 'stopped', mrepo: 'local/stopped', folder: join(work, 'mrepos', 'local', 'stopped'), component: 'splectral/x', list: ['splectral/r'], installed: 'now' }))
  mkdirSync(join(work, 'mrepos', 'local', 'stopped', SIDE, 'outbox'), { recursive: true })
  const s = await serve({ outbox: join(boot, 'outbox'), dir, port: 0, every: 200, wait: 1500 })
  try {
    t.alike(s.components(), ['quiet', 'stopped', 'viewer'], 'its components, from the records install leaves')
    const page = await ask(`${s.url}/viewer/hdlc/validation?x=1`)
    t.is(page.status, 200, 'a component\'s page')
    t.ok(page.body.includes('<a href="/install">install</a><a href="/quiet/">quiet</a><a href="/stopped/">stopped</a><a href="/viewer/" class="on" aria-current="page">viewer</a>'), 'in the site: a tab a component, its own shown')
    t.ok(page.body.includes('srcdoc="<base href=&quot;/viewer/&quot; target=&quot;_top&quot;><h1>Validation</h1>"'), 'its page in the site\'s content area, as the component made it, its base its section')
    t.alike([pages[0].path, pages[0].query], ['hdlc/validation', { x: '1' }], 'the page asked: its path below the component, its query')
    t.alike(asked, [{ topic: '/local/boot/inbox', parts: ['haicc', 'docs', 'info/get', 'hdlc/validation'], trigger: 'external' }], 'its data request: a command at the root, as a terminal sends it')
    t.ok(await until(() => readdirSync(join(viewer, SIDE, 'outbox')).length === 0), 'what the server took from the component\'s outbox removed')
    t.is(JSON.parse(answered.records[0]).value.value.output.page.split('\n')[0], '# Validation', 'asked raw: the response whole as well, as its folder holds it (what the terminal prints)')
    put(join(viewer, SIDE, 'outbox'), 'm0000000-0000-4000-8000-000000000000', { topic: '/splectral', key: 'm0000000-0000-4000-8000-000000000000', timestamp: new Date().toISOString(), headers: {}, value: { topic: '/local/viewer/splectral/inbox', key: 'm0000000-0000-4000-8000-000000000000', timestamp: new Date().toISOString(), headers: {}, value: { request: 'mrepos' } } })
    t.ok(await until(() => answered.mrepos.length === 1), 'the install\'s mrepos asked: answered by the server')
    t.alike(answered.mrepos[0], { version: 0, mrepos: [{ at: '.', depth: 0, package: null }] }, 'from its structure, nothing run: the root alone here, no record having said more')
    // an mrepo by its unique URI: resolved at the root from the registry, kept
    const mrepo = (n, uri) => put(join(viewer, SIDE, 'outbox'), `a000000${n}-0000-4000-8000-000000000000`, { topic: '/splectral', key: `a000000${n}-0000-4000-8000-000000000000`, timestamp: new Date().toISOString(), headers: {}, value: { topic: '/local/viewer/splectral/inbox', key: `a000000${n}-0000-4000-8000-000000000000`, timestamp: new Date().toISOString(), headers: {}, value: { request: 'mrepo', uri } } })
    mrepo(1, 'local/docs')
    t.ok(await until(() => answered.mrepo.length === 1), 'an mrepo by its unique URI asked: answered')
    t.alike([answered.mrepo[0], asked.at(-1).parts], [{ uri: 'local/docs', position: 'workbench/docs' }, ['haicc/mrepos', 'local/docs']], 'its position from the root, as haicc/mrepos at the root says it from the registry')
    const n = asked.length
    mrepo(2, 'local/docs')
    t.ok(await until(() => answered.mrepo.length === 2), 'asked again')
    t.alike([answered.mrepo[1], asked.length], [{ uri: 'local/docs', position: 'workbench/docs' }, n], 'kept: nothing asked of the root again')
    mrepo(3, 'local/none')
    mrepo(4, 'local/lost')
    mrepo(5, 'docs')
    t.ok(await until(() => answered.mrepo.length === 5), 'three more asked')
    t.alike(answered.mrepo.slice(2).map(a => a.error).sort(), ['not a unique URI: docs (<namespace>/<name>)', 'local/lost: not reachable from the root', 'no mrepo local/none in the install\'s registry'].sort(), 'not in the registry, not reachable, not a unique URI: each said')
    const none = await ask(`${s.url}/quiet/x`)
    t.is(none.status, 504, 'a component that does not answer: said')
    t.ok(none.body.includes('is its service started?'))
    const stopped = await ask(`${s.url}/stopped/x`)
    t.alike([stopped.status, stopped.body.includes('not running: stopped'), stopped.body.includes('<a href="/stopped/" class="on"')], [503, true, true], 'one whose program does not run: said at once, in the site')
    t.is((await ask(`${s.url}/nothing`)).status, 404, 'no component there: nothing here')
  } finally {
    await s.close()
    root.stop()
    renderer.stop()
    rmSync(work, { recursive: true, force: true })
  }
})
