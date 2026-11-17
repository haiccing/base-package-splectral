// The package as it is mounted and as it defines its mrepo: its
// protocol.js, what a runtime loads through the dispatcher's /protocol
// entry (imported here directly: this test is itself run by the
// dispatcher), its config value by value; its list of packages and its
// hooks, file by file; and each action run on a minimal execution, its
// server started for real from the package's own program, run.js, asked
// over HTTP and ended. No mrepo is built. Every action the config names
// and every hook file must be named and run here: the tests fail when
// one was left out.
import test from '../../modules/node_modules/brittle/index.js'
import http from '../../modules/node_modules/bare-http1/index.js'
import os from '../../modules/node_modules/bare-os/index.js'
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from '../../modules/node_modules/bare-fs/index.js'
import { join, dirname } from '../../modules/node_modules/bare-path/index.js'
import { fileURLToPath } from '../../modules/node_modules/bare-url/index.js'
import * as mounted from '../../protocol.js'

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const json = (...p) => JSON.parse(readFileSync(join(pkg, ...p), 'utf8'))
// catch: no such process: not alive
const alive = pid => { try { os.kill(pid, 0); return true } catch { return false } }
const ask = url => new Promise((resolve, reject) => {
  const req = http.request(url, res => { let body = ''; res.on('data', d => { body += d }); res.on('end', () => resolve({ status: res.statusCode, body })) })
  req.on('error', reject)
  req.end()
})

// An execution as an action sees it: the mrepo it runs in, its log kept.
function execution (runtime) {
  return {
    runtime,
    log: function (level, event, data = {}) { (this.entries ??= []).push({ level, event, ...data }) },
    step: async function (event, data, fn, level = 'verbose') { const r = await fn(); (this.entries ??= []).push({ level, event, ...(typeof data === 'function' ? data(r) : data) }); return r }
  }
}
const ran = new Set()
// an action that wrote into the execution's log as it ran: every one must
const logged = new Set()
const act = async (name, exec, form = {}, opts = {}) => {
  ran.add(name)
  const before = exec.entries?.length ?? 0
  // (one refused before it did anything has logged nothing)
  try { return await mounted.actions.splectral[name](exec, form, opts) } finally { if ((exec.entries?.length ?? 0) > before) logged.add(name) }
}

test('loaded as a runtime loads it: one protocol, splectral, its config and its actions', (t) => {
  t.alike(Object.keys(mounted.protocols), ['splectral'], 'the package provides the splectral protocol, and no other')
  t.alike(Object.keys(mounted.actions), ['splectral'])
  t.alike(Object.keys(mounted.actions.splectral).sort(), Object.keys(mounted.protocols.splectral.actions).sort(), 'a function for every action configured, and no other')
})

test('its config, value by value', (t) => {
  const cfg = mounted.protocols.splectral
  t.is(cfg.package, 'haiccing/base-package-splectral', 'the package that brings it')
  t.ok(cfg.description, 'its description')
  t.alike(Object.keys(cfg).sort(), ['actions', 'description', 'package'], 'nothing else: no default action, not behind a state')
  t.alike(Object.keys(cfg.actions).sort(), ['start', 'status', 'stop'], 'start, stop and status')
  for (const [name, a] of Object.entries(cfg.actions)) {
    t.alike(a.uris, ['.'], `${name}: at the mrepo itself`)
    t.ok(a.description, `${name}: its description`)
    t.absent('states' in a || 'target' in a, `${name}: no states, no target`)
  }
  t.alike([cfg.actions.start.args, 'args' in cfg.actions.stop, 'args' in cfg.actions.status], [['port?'], false, false], 'start: a port, optional; stop and status: no argument')
})

// The hooks the package brings, as they are in its structure: by
// <transition>/<name>, each its command.
const hooksDir = join(pkg, 'mrepo', 'runtime', 'hooks')
const brought = {}
for (const f of existsSync(hooksDir) ? readdirSync(hooksDir).sort() : []) readFileSync(join(hooksDir, f), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).forEach((l, i) => { brought[`${f.replace(/\.haicc$/, '')}/${i + 1}`] = l.split(/\s+/) })

test('the mrepo it defines: its list of packages, itself last; its hooks, file by file; the state it starts in', (t) => {
  t.alike(json('mrepo', 'packages', 'layer.json').packages, [
    'haiccing/base-package-runtime',
    'haiccing/base-package-info',
    'haiccing/base-package-protocol',
    'haiccing/base-package-service',
    'haiccing/base-package-splectral'
  ], 'the runtime, info, the protocol protocol, the service, this package: deployed as the target, it makes the Splectral mrepo')
  t.alike(brought, {
    'boot/1': ['protocol/activate', '.', 'info'],
    'boot/2': ['protocol/activate', '.', 'runtime'],
    'boot/3': ['protocol/activate', '.', 'service'],
    'initialise/1': ['info/extract'],
    'start/1': ['protocol/activate', '.', 'splectral'],
    'start/2': ['splectral/start'],
    'stop/1': ['splectral/stop'],
    'stop/2': ['protocol/deactivate', '.', 'splectral']
  }, 'each hook file, its transition, each line its command; none that is not named here')
  t.alike(json('mrepo', 'runtime', 'service.json'), { state: 'booted' }, 'a Splectral mrepo starts booted')
  // in line order, as a transition runs them: opened before it serves, closed before it is shut
  t.alike([brought['start/1'][0], brought['start/2'][0], brought['stop/1'][0], brought['stop/2'][0]], ['protocol/activate', 'splectral/start', 'splectral/stop', 'protocol/deactivate'], 'start: activated, then served; stop: its server ended, then deactivated')
  for (const [name, [first]] of Object.entries(brought)) {
    const [p, a] = first.split('/')
    if (p === 'splectral') t.ok(mounted.protocols.splectral.actions[a], `${name}: ${first} is an action of the protocol`)
  }
  t.alike(readFileSync(join(pkg, 'scripts', 'start.haicc'), 'utf8').split('\n').filter(l => l && !l.startsWith('#')), ['service/initialise', 'service/start'], 'its script start: the mrepo brought into service, its start hook starting the server')
})

test('the actions: nothing running; what start refuses; its server started from the package\'s own program, asked, ended', { timeout: 60000 }, async (t) => {
  const work = mkdtempSync(join(os.tmpdir(), 'splectral-mounted-'))
  const dir = join(work, 'mrepos', 'local', 'splectral')
  const outbox = join(work, 'mrepos', 'boot', 'outbox')
  mkdirSync(dir, { recursive: true })
  let pid = null
  try {
    const exec = execution({ dir, work })
    t.alike(await act('status', exec), { running: false }, 'status: not running')
    t.alike(await act('stop', exec), { splectral: 'stopped', pid: null }, 'stop: none running, no error')
    await t.exception(act('start', exec, { args: ['web'] }), /not a port: web/)
    await t.exception(act('start', execution({ dir, work: null })), /no work folder in the context/)
    writeFileSync(join(work, 'mrepo.json'), JSON.stringify({ storage: 'filesystem', name: 'boot' }))
    await t.exception(act('start', exec), /nothing to follow: .*mrepos\/boot\/outbox/, 'the root mrepo has no outbox folder')
    mkdirSync(outbox, { recursive: true })
    await t.exception(act('start', exec), /no server to start: haiccing\/base-package-splectral is not among the mrepo's packages/, 'its bundle not in the mrepo\'s packages')
    // a completed record there, as the root mrepo writes its outbox folder
    const key = '11111111-1111-4111-8111-111111111111'
    writeFileSync(join(outbox, `${key}.json`), JSON.stringify({ topic: '/outbox', key, timestamp: '2026-11-16T10:00:01.250Z', headers: {}, value: { topic: '/haicc/terminal', key, timestamp: '2026-11-16T10:00:01.000Z', headers: {}, value: { command: ['haicc', 'host', 'service/start'], protocol: 'haicc', action: 'goto', uri: ['main', 'host'], args: ['service/start'], log: [{ event: 'request.sent', mrepo: 'local/host' }], output: { service: 'started', state: 'started' } } } }))
    // started from the package's own program: run.js, as its bundle's /run entry runs it
    const s = await act('start', exec, { args: ['0'] }, { program: join(pkg, 'run.js') })
    pid = s.pid
    t.alike([s.splectral, s.outbox, /^http:\/\/127\.0\.0\.1:\d+$/.test(s.url), alive(s.pid)], ['started', outbox, true, true], 'start: the package\'s program running as its own process, following the root mrepo\'s outbox folder')
    const page = await ask(`${s.url}/`)
    t.alike([page.status, page.body.includes('<title>Splectral</title>')], [200, true], 'its page served')
    t.alike(JSON.parse((await ask(`${s.url}/records`)).body).records.map(l => [l.command, l.through, l.ok, l.ms]), [['haicc host service/start', ['local/host'], true, 250]], 'its lines: the record in the folder, summed up')
    const st = await act('status', exec)
    t.alike([st.running, st.url, st.pid], [true, s.url, s.pid], 'status: running, where')
    t.alike(await act('stop', exec), { splectral: 'stopped', pid: s.pid }, 'stop: ended')
    t.absent(alive(s.pid), 'its process gone')
    pid = null
  } finally {
    // catch: ended meanwhile: nothing to signal
    if (pid) try { os.kill(pid, 'SIGKILL') } catch {}
    rmSync(work, { recursive: true, force: true })
  }
})

test('every action the config names was run here', (t) => {
  t.alike([...ran].sort(), Object.keys(mounted.protocols.splectral.actions).sort(), 'start, status and stop')
  t.alike([...logged].sort(), Object.keys(mounted.protocols.splectral.actions).sort(), 'and each wrote into the request\'s log as it ran: an action that logs nothing fails this')
})
