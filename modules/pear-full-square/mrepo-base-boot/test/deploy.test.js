// The boot protocol's actions, with a context like the execute protocol's
// (reads from the repository, writes collected, then committed; exec.commit()
// a local commit). A parent built with its packages manifest naming the
// store; the child deployed from a target package's list, inside the parent.
import test from 'brittle'
import fs, { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from 'bare-fs'
import crypto from 'bare-crypto'
import { join } from 'bare-path'
import { tmpdir } from 'bare-os'
import Bundle from 'bare-bundle'
import { openRepo, writer, p2pgitBackend } from 'mycelium-git'
import { record, wrap, guid } from 'mrepo-base-request'
import { ask } from 'mrepo-base-runtime'
import { spawn, spawnSync } from 'bare-subprocess'
import process from 'bare-process'
import { build, deploy, teardown, redeploy, place, parseSource, lay } from '../index.js'

const lj = (dir, mode) => { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'layer.json'), JSON.stringify({ mode, description: 'test' })) }
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex')
const json = b => JSON.parse(b.toString())

// A source by organisation holding bundles whose mrepo/ parts are given
// (and, by a slash-led path, its other files: its scripts).
function source (dir, packages) {
  mkdirSync(join(dir, 'haiccing'), { recursive: true })
  const manifest = { packages: {} }
  for (const [pkg, files] of Object.entries(packages)) {
    const b = new Bundle()
    // (a path with a leading slash: a file of the package beside its mrepo/, a script)
    for (const [p, v] of Object.entries(files)) b.write(p.startsWith('/') ? p : `/mrepo/${p}`, Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)))
    const bytes = b.toBuffer()
    writeFileSync(join(dir, `${pkg}.bundle`), bytes)
    manifest.packages[pkg] = { file: `${pkg}.bundle`, id: pkg, sha256: sha256(bytes), entries: [], addons: [] }
  }
  writeFileSync(join(dir, 'haiccing', 'manifest.json'), JSON.stringify(manifest))
}

// A parent: main, runtime, packages, links; its packages manifest (the store, the sources).
async function parent (work, sources) {
  const src = mkdtempSync(join(tmpdir(), 'deploy-parent-'))
  try {
    for (const l of ['main', 'runtime', 'packages', 'links']) lj(join(src, l), 'atomic')
    const { dir } = await build({ from: src, work, name: 'boot' })
    await place({ dir, store: join(work, 'packages'), sources, list: [] })
    return dir
  } finally { rmSync(src, { recursive: true, force: true }) }
}

// An execution's context: reads the repository, writes collected and
// committed to their layers after the action (exec.commit(): a local commit).
function context (dir, backend, work) {
  const repo = openRepo(backend)
  const abs = p => (p.startsWith('/') ? p : `/${p}`)
  const edits = []
  const exec = {
    runtime: { name: 'boot', uri: 'local/boot', dir, work },
    // the tree itself, for a query
    node: uri => repo.node(abs(uri)),
    children: node => repo.children(node),
    bytes: node => repo.bytes(node),
    // (paths given relative from the root or slash-led, the same)
    select: uri => repo.select(abs(uri)),
    read: uri => repo.read(abs(uri)),
    // the rest of an execution context, standing in: a file that may not
    // be there, the log (kept: entries), a step run as it is
    find: async function (p) { try { return await this.read(p) } catch { return null } },
    log: function (level, event, data = {}) { (this.entries ??= []).push({ level, event, ...data }) },
    step: async function (event, data, fn, level = 'verbose') { const r = await fn(); (this.entries ??= []).push({ level, event, ...(typeof data === 'function' ? data(r) : data) }); return r },
    // (a continuation answered with: kept)
    continuation: function (script, at) { this.continued = { at, script } },
    put: (uri, bytes) => edits.push(['put', abs(uri), bytes]),
    remove: uri => edits.push(['remove', abs(uri)]),
    commit: () => commit()
  }
  async function commit () {
    if (!edits.length) return
    const all = edits.splice(0)
    for (const l of new Set(all.map(([, uri]) => uri.split('/')[1]))) {
      const c = await writer(backend).change(l)
      for (const [op, uri, bytes] of all.filter(([, uri]) => uri.split('/')[1] === l)) op === 'put' ? await c.put(uri.slice(l.length + 1), bytes) : c.remove(uri.slice(l.length + 1))
      await c.commit('test', { author: { name: 'test', email: 'test@localhost' } })
    }
  }
  return { exec, commit, repo }
}

test('documents: sources: every package the sources offer beyond the list placed, documented only: no structure laid in, no entry, no addon', async (t) => {
  const pkgs = mkdtempSync(join(tmpdir(), 'documents-src-'))
  const into = mkdtempSync(join(tmpdir(), 'documents-into-'))
  const dir = mkdtempSync(join(tmpdir(), 'documents-dir-'))
  const store = mkdtempSync(join(tmpdir(), 'documents-store-'))
  try {
    source(pkgs, {
      'haiccing/base': { 'runtime/layer.json': { mode: 'atomic' } },
      'haiccing/other': { 'other/layer.json': { mode: 'atomic' }, 'runtime/hooks/boot/x.json': ['x/y'] },
      'haiccing/docs': { 'packages/layer.json': { mode: 'replicated', packages: ['haiccing/base', 'haiccing/docs'], documents: 'sources' } },
      'haiccing/plain': { 'packages/layer.json': { mode: 'replicated', packages: ['haiccing/plain'] } },
      'haiccing/odd': { 'packages/layer.json': { mode: 'replicated', packages: ['haiccing/odd'], documents: 'all' } }
    })
    const sources = [parseSource(`folder:${pkgs}`)]
    const { list, documented } = lay({ store, sources, target: 'haiccing/docs', into })
    t.alike([list, documented], [['haiccing/base', 'haiccing/docs'], ['haiccing/odd', 'haiccing/other', 'haiccing/plain']], 'the list, and every other package the sources offer, sorted')
    t.absent(existsSync(join(into, 'other')), 'a documented package lays nothing in')
    t.alike(lay({ store, sources, target: 'haiccing/plain', into: mkdtempSync(join(tmpdir(), 'documents-plain-')) }).documented, [], 'no documents: nothing beyond the list')
    t.exception(() => lay({ store, sources, target: 'haiccing/odd', into }), /haiccing\/odd: documents what\? all \(sources\)/, 'documents anything but sources: refused')
    lj(join(dir, 'packages'), 'replicated')
    const { dir: built } = await build({ from: dir, work: store, name: 'docs' })
    const { packages } = await place({ dir: built, store, sources, list, documented })
    t.alike(Object.keys(packages), [...list, ...documented], 'all placed, the list first')
    t.alike([packages['haiccing/other'].documented, packages['haiccing/other'].entries, packages['haiccing/base'].documented], [true, [], undefined], 'the documented marked, no entry: nothing of it runs')
    t.ok(existsSync(join(built, 'packages', 'haiccing', 'other.bundle')), 'its bundle there, for its pages')
  } finally { for (const d of [pkgs, into, dir, store]) rmSync(d, { recursive: true, force: true }) }
})

test('deploy from a target package\'s list, placed by its unique URI, its link recorded; redeploy; teardown; a script answered as a continuation; the mrepo registry, several torn down; a swarm\'s node', async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'deploy-'))
  const pkgs = mkdtempSync(join(tmpdir(), 'deploy-src-'))
  try {
    source(pkgs, {
      'haiccing/base': { 'runtime/layer.json': { mode: 'atomic' }, 'runtime/kind.json': { kind: 'base' }, 'runtime/hooks/boot/base.json': ['x/y'], 'inbox/layer.json': { mode: 'non-atomic' } },
      'haiccing/target': { '/scripts/start.haicc': 'service/initialise\nservice/start\n', '/scripts/broken.haicc': '# nothing\n', 'main/layer.json': { mode: 'atomic' }, 'runtime/kind.json': { kind: 'target' }, 'packages/layer.json': { mode: 'replicated', packages: ['haiccing/base', 'haiccing/target'] } }
    })
    const dir = await parent(work, [parseSource(`folder:${pkgs}`)])
    const backend = p2pgitBackend(join(dir, '.git'), { fs })
    const { exec, commit, repo } = context(dir, backend, work)

    await t.exception(deploy(exec, { uri: ['main', 'host'] }), /missing argument: package/, 'the package: its first argument, missing said')
    await t.exception(deploy(exec, { uri: ['main', '.'], args: ['haiccing/target'] }), /missing argument: target/, 'a target of main itself: the mrepo, which one cannot deploy; missing')
    await t.exception(teardown(exec, { uri: ['main', '.'] }), /missing argument: target/, 'nor tear down')
    await t.exception(deploy(exec, { uri: ['.'], args: ['haiccing/target'] }), /missing argument: target/, 'the root the same')
    await t.exception(deploy(exec, { uri: ['host'], args: ['haiccing/target'] }), /not a position in main: host \(main\/<name>\)/, 'from the root the layer comes first')
    // a position that exists locally (data in main there): not a target
    exec.put('/main/notes/a.json', Buffer.from('1'))
    await commit()
    await t.exception(deploy(exec, { uri: ['main', 'notes'], args: ['haiccing/target'] }), /^Error: notes exists locally: the boot protocol cannot target it|^notes exists locally: the boot protocol cannot target it/, 'a local folder: deploy cannot target it')
    await t.exception(teardown(exec, { uri: ['main', 'notes'] }), /notes exists locally/, 'nor teardown')
    await t.exception(teardown(exec, { uri: ['main', 'nothing'] }), /not deployed: nothing/, 'nothing there at all: not deployed')
    const d = await deploy(exec, { uri: ['main', 'host'], args: ['haiccing/target'] })
    await commit()
    const host = join(work, 'mrepos', 'local', 'host')
    t.is(d.deployed, 'host', 'said as it is written at main')
    t.ok(existsSync(join(host, '.git')), 'placed by its unique URI, side by side with its parent: <work>/mrepos/local/host')
    t.absent(existsSync(join(dir, 'main')), 'nothing of it inside the parent\'s folder')
    t.alike(Object.keys(d.layers).sort(), ['inbox', 'main', 'packages', 'runtime'], 'the layers of every listed package')
    const child = openRepo(p2pgitBackend(join(host, '.git'), { fs }))
    t.alike(json(await child.read('/runtime/kind.json')), { kind: 'target' }, 'its runtime config: the last package\'s, the one that defines the mrepo')
    t.is(await child.read('/runtime/hooks/boot/base.json').catch(() => null), null, 'runtime config from the last package only: another\'s is not laid in')
    t.ok(await child.read('/runtime/layer.json').then(() => true, () => false), 'the runtime layer itself is structure: from whichever package brings it')
    t.alike(d.packages, ['haiccing/base', 'haiccing/target'], 'its packages, in order')
    t.is(statSync(join(work, 'packages', 'haiccing', 'base.bundle')).ino, statSync(join(host, 'packages', 'haiccing', 'base.bundle')).ino, 'each linked from the store')
    const [shortcut] = json(await repo.read('/main/host/.shortcuts.json'))
    t.alike([Object.keys(shortcut), shortcut.mrepo, /^[0-9a-f-]{36}$/.test(shortcut.link)], [['mrepo', 'link'], 'local/host', true], 'its shortcut, in main beside its node: a list, the mrepo linked there by its unique URI (in its parent\'s swarm) and the link\'s own key: what is needed to show it')
    t.alike(json(await repo.read('/main/host/.node.json')), {}, 'its node, in main: an empty document')
    t.alike(json(await repo.read(`/links/${shortcut.link}.json`)), { key: shortcut.link, uri: 'local/host', at: 'host', how: 'deployed', folder: '../local/host', package: 'haiccing/target', packages: d.packages, layers: d.layers }, 'what is local to this machine about it, its link\'s record in the links layer, by the link\'s key: which mrepo, the position that links to it, how it came about, where it is (from this mrepo\'s folder), what it came from; main replicates, this does not')
    t.is(await repo.find('/main/registry/local/host/.node.json'), null, 'no mrepo registry kept here: main has no registry node')
    t.alike([d.mrepo, d.package], ['local/host', 'haiccing/target'], 'both said in what deploy returns')
    t.alike(json(await child.read('/runtime/mrepo.json')), { uri: 'local/host' }, 'its identity, in its own runtime layer')
    await t.exception(deploy(exec, { uri: ['main', 'host'], args: ['haiccing/target'] }), /deployed already/)

    await t.exception(deploy(exec, { uri: ['main', 'y'], args: ['none'] }), /not fully qualified: none \(<org>\/<package>\)/, 'a package named without its organisation: refused, none assumed')
    await t.exception(deploy(exec, { uri: ['main', 'y'], args: ['haiccing/none'] }), /not in the store nor the sources/, 'fully qualified, not there: said')
    const r = await redeploy(exec, { uri: ['main', 'host'] })
    await commit()
    t.is(r.tornDown, 'host')
    t.is(r.package, 'haiccing/target', 'redeployed, its type as recorded')
    t.is(json(await repo.read('/main/host/.shortcuts.json'))[0].link, shortcut.link, 'the link keeps its key: the same link, its mrepo built again')

    // a runtime that does not stop (no socket, SIGTERM ignored): teardown ends it all the same
    const stubborn = spawn('sh', ['-c', 'trap "" TERM; while true; do sleep 1; done'], { stdio: 'ignore', detached: true })
    const key = json(await repo.read('/main/host/.shortcuts.json'))[0].link
    const rec = json(await repo.read(`/links/${key}.json`))
    exec.put(`/links/${key}.json`, Buffer.from(JSON.stringify({ ...rec, runtime: { pid: stubborn.pid } })))
    await commit()
    exec.entries = []
    t.alike(await teardown(exec, { uri: ['main', 'host'] }), { tornDown: 'host' })
    t.absent(spawnSync('kill', ['-0', String(stubborn.pid)], { stdio: 'ignore' }).status === 0, 'a runtime that would not stop: ended (SIGKILL)')
    t.is(exec.entries.find(e => e.event === 'runtime')?.stopped?.how, 'SIGKILL', 'and how, logged: the step that stopped it')
    t.alike(exec.entries.filter(e => e.level === 'info').map(e => e.event), ['torn down'], 'what it did, at info')
    await commit()
    t.absent(existsSync(host), 'removed')
    t.alike([await repo.read('/main/host/.shortcuts.json').catch(() => null), await repo.read('/main/host/.node.json').catch(() => null), (await repo.select('/links/*')).filter(([p]) => !p.endsWith('layer.json')).length], [null, null, 0], 'its shortcut and its node out of main, what was local out of the runtime layer')
    await t.exception(teardown(exec, { uri: ['main', 'host'] }), /not deployed/)
    // a continuation asked for: a script of the package deployed, answered with the deploy
    await t.exception(deploy(exec, { uri: ['main', 'scripted'], args: ['haiccing/target'], flags: { continuation: 'nope' } }), /no script: nope \(haiccing\/target has broken, start\)/, 'a script the package has not: refused, with those it has')
    t.absent(existsSync(join(work, 'mrepos', 'local', 'scripted')), 'before anything is built')
    await t.exception(deploy(exec, { uri: ['main', 'scripted'], args: ['haiccing/target'], flags: { continuation: 'broken' } }), /not a script: haiccing\/target broken \(no command in it\)/)
    exec.continued = null
    await deploy(exec, { uri: ['main', 'scripted'], args: ['haiccing/target'], flags: { continuation: 'start' } })
    await commit()
    t.alike(exec.continued, { at: 'scripted', script: 'service/initialise\nservice/start\n' }, 'deploy with continuation=start: the package\'s script of that name answered as its continuation, run for the deployed mrepo\'s position')
    exec.continued = null
    await redeploy(exec, { uri: ['main', 'scripted'] })
    await commit()
    t.is(exec.continued, null, 'not asked for: none')
    await teardown(exec, { uri: ['main', 'scripted'] })
    await commit()
    // the mrepo registry, where main has the node `registry` (the boot mrepo): an mrepo's node by its unique URI
    exec.put('/main/registry/.node.json', Buffer.from('{}\n'))
    await commit()
    await t.exception(deploy(exec, { uri: ['main', 'registry'], args: ['haiccing/target'] }), /registry exists locally/, 'the registry\'s own position is no target')
    for (const n of ['one', 'two', 'three']) { await deploy(exec, { uri: ['main', n], args: ['haiccing/target'] }); await commit() }
    t.alike((await repo.select('/main/registry/local/*')).map(([p]) => p).filter(p => !p.endsWith('.node.json')), ['/main/registry/local/one', '/main/registry/local/three', '/main/registry/local/two'], 'three deployed: three nodes in the registry, by unique URI')
    const one = json(await repo.read('/main/registry/local/one/.node.json'))
    t.alike([one.uri, one.at, one.how, one.folder, one.package, one.key === json(await repo.read('/main/one/.shortcuts.json'))[0].link], ['local/one', 'one', 'deployed', '../local/one', 'haiccing/target', true], 'a node there: the mrepo\'s record, the same as its link\'s')
    t.alike(json(await repo.read('/main/registry/local/.node.json')), {}, 'its swarm a node above it')
    t.alike(await teardown(exec, { uri: ['main', "registry/local/*[at='one' or at='two']"] }), [{ tornDown: 'one' }, { tornDown: 'two' }], 'teardown with a URI into the registry: the mrepos a query selects there, each torn down at its position')
    await commit()
    t.alike([existsSync(join(work, 'mrepos', 'local', 'one')), existsSync(join(work, 'mrepos', 'local', 'two')), existsSync(join(work, 'mrepos', 'local', 'three'))], [false, false, true], 'their folders gone, the third left')
    t.alike([await repo.find('/main/registry/local/one/.node.json'), (await repo.select('/links/*')).filter(([p]) => !p.endsWith('layer.json')).length], [null, 1], 'out of the registry, their links\' records gone: one link left')
    t.alike(await teardown(exec, { uri: ['main', 'registry/local/*'] }), [{ tornDown: 'three' }], 'all that is left')
    await commit()
    t.alike(await teardown(exec, { uri: ['main', 'registry/local/*'] }), [], 'nothing registered: nothing torn down, no error')
    await t.exception(deploy(exec, { uri: ['main', 'x'], args: ['haiccing/none'] }), /not in the store nor the sources/)
    await t.exception(deploy(exec, { uri: ['main', '../x'], args: ['haiccing/target'] }), /bad segment/, 'no way up')
    await t.exception(deploy(exec, { uri: ['main', 'a/B'], args: ['haiccing/target'] }), /not canonical|not a position for an mrepo/, 'a name of lowercase letters, digits, hyphens')
    exec.put('/main/linked/.node.json', Buffer.from('{}\n'))
    exec.put('/main/linked/.shortcuts.json', Buffer.from('[{"mrepo":"local/linked","link":"k-linked"}]\n'))
    await commit()
    await t.exception(deploy(exec, { uri: ['main', 'linked/deeper'], args: ['haiccing/target'] }), /linked is a shortcut: a URI does not run through it/, 'below a shortcut: another mrepo\'s')
    // deeper below main: the node above it there first
    await t.exception(deploy(exec, { uri: ['main', 'swarms/swarm-1/node-1'], args: ['haiccing/target'] }), /no node there: swarms\/swarm-1 \(crud\/create swarms\/swarm-1\)/, 'the node above it is there first')
    t.absent(existsSync(join(work, 'mrepos', 'swarm-1')), 'nothing built')
    exec.put('/main/swarms/.node.json', Buffer.from('{}\n'))
    exec.put('/main/swarms/local/.node.json', Buffer.from('{"kind":"swarm"}\n'))
    exec.put('/main/plain/.node.json', Buffer.from('{}\n'))
    await commit()
    await t.exception(deploy(exec, { uri: ['main', 'swarms/local/node-1'], args: ['haiccing/target'] }), /not a swarm: local/, 'local is the swarm of what is in none')
    // a position whose node above says nothing: in its parent's swarm
    const p = await deploy(exec, { uri: ['main', 'plain/node-0'], args: ['haiccing/target'] })
    await commit()
    t.alike([p.deployed, p.mrepo], ['plain/node-0', 'local/node-0'], 'deeper, no swarm above it: in its parent\'s swarm, local')
    t.alike(await teardown(exec, { uri: ['main', 'plain/node-0'] }), { tornDown: 'plain/node-0' })
    await commit()
    // a swarm's node: the nearest node above it whose document says it is a swarm names the swarm
    exec.put('/main/swarms/swarm-1/.node.json', Buffer.from('{"kind":"swarm"}\n'))
    await commit()
    const n = await deploy(exec, { uri: ['main', 'swarms/swarm-1/node-1'], args: ['haiccing/target'] })
    await commit()
    t.alike([n.deployed, n.mrepo], ['swarms/swarm-1/node-1', 'swarm-1/node-1'], 'deployed at swarms/<swarm>/<name>: its unique URI <swarm>/<name>, the swarm its position names')
    t.ok(existsSync(join(work, 'mrepos', 'swarm-1', 'node-1', '.git')), 'placed by it: <work>/mrepos/swarm-1/node-1')
    t.alike(json(await openRepo(p2pgitBackend(join(work, 'mrepos', 'swarm-1', 'node-1', '.git'), { fs })).read('/runtime/mrepo.json')), { uri: 'swarm-1/node-1' }, 'its identity')
    const [ns] = json(await repo.read('/main/swarms/swarm-1/node-1/.shortcuts.json'))
    const nl = json(await repo.read(`/links/${ns.link}.json`))
    t.alike([ns.mrepo, nl.uri, nl.at, nl.folder], ['swarm-1/node-1', 'swarm-1/node-1', 'swarms/swarm-1/node-1', '../swarm-1/node-1'], 'its shortcut at that position, its link\'s record: the position, where it is')
    t.alike(json(await repo.read('/main/registry/swarm-1/node-1/.node.json')).at, 'swarms/swarm-1/node-1', 'in the mrepo registry by its unique URI, its swarm a node there')
    await t.exception(deploy(exec, { uri: ['main', 'swarms/swarm-1/node-1'], args: ['haiccing/target'] }), /deployed already: swarms\/swarm-1\/node-1/)
    t.alike(await teardown(exec, { uri: ['main', 'registry/swarm-1/*'] }), [{ tornDown: 'swarms/swarm-1/node-1' }], 'torn down through the registry, at its position')
    await commit()
    t.alike([existsSync(join(work, 'mrepos', 'swarm-1', 'node-1')), await repo.find('/main/swarms/swarm-1/node-1/.node.json'), json(await repo.read('/main/swarms/swarm-1/.node.json'))], [false, null, { kind: 'swarm' }], 'gone, its swarm\'s node left')
    await t.exception(deploy(exec, { uri: 'main/host', args: ['haiccing/target'] }), /not a URI: its segments, an array/, 'a URI as one string: not a form\'s')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(pkgs, { recursive: true, force: true })
  }
})

// The runtime's bundle as the development repository's sources hold it
// (tools/package-bundle.js); the test skipped without.
// (SOURCES: a sources folder given, as a package's tests pass theirs)
const SOURCES = process.env.SOURCES || join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', '..', '..', 'sources')
const haveRuntime = existsSync(join(SOURCES, 'haiccing', 'base-package-runtime.bundle'))

test('deploy the runtime: the child\'s runtime started from its own packages, its inbox answering; teardown stops it', { timeout: 60000, skip: !haveRuntime }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'deploy-rt-'))
  try {
    const dir = await parent(work, [parseSource(`folder:${SOURCES}`)])
    const backend = p2pgitBackend(join(dir, '.git'), { fs })
    const { exec, commit } = context(dir, backend, work)
    const d = await deploy(exec, { uri: ['main', 'host'], args: ['haiccing/base-package-runtime'] })
    await commit()
    const host = join(work, 'mrepos', 'local', 'host')
    t.ok(d.runtime?.pid, 'its runtime started')
    t.alike([(await ask({ repo: host, op: 'status' }))?.repository.name, (await ask({ repo: host, op: 'status' }))?.repository.uri], ['host', 'local/host'], 'running the child, by its directory; its unique URI its own')
    // a request into its inbox folder (the parent reaches it, forward): answered
    const core = record('/test', ['info/get'], guid())
    writeFileSync(join(host, 'inbox', `${core.key}.json`), JSON.stringify(wrap('/local/host/inbox', core)))
    const child = openRepo(p2pgitBackend(join(host, '.git'), { fs }))
    let back = null
    for (let i = 0; i < 100 && !back; i++) { back = await child.read(`/outbox/${core.key}.json`).then(json, () => null); if (!back) await new Promise(resolve => setTimeout(resolve, 100)) }
    t.ok(back?.value.value.output?.choices?.[0]?.title, `its inbox operational: its boot hooks run (info activated, extracted), a request answered ${back?.value.value.error ?? ''}`)
    let inFolder = null
    for (let i = 0; i < 50 && !inFolder; i++) { inFolder = existsSync(join(host, 'outbox', `${core.key}.json`)) ? JSON.parse(readFileSync(join(host, 'outbox', `${core.key}.json`))) : null; if (!inFolder) await new Promise(resolve => setTimeout(resolve, 100)) }
    t.alike(inFolder?.value.value, back.value.value, 'and in its outbox folder, as committed (for a subscriber)')
    await teardown(exec, { uri: ['main', 'host'] })
    await commit()
    t.is(await ask({ repo: host, op: 'status' }), null, 'teardown: its runtime stopped')
    t.absent(spawnSync('kill', ['-0', String(d.runtime.pid)], { stdio: 'ignore' }).status === 0, 'its process ended')
    t.absent(existsSync(host), 'and removed')
  } finally { rmSync(work, { recursive: true, force: true }) }
})
