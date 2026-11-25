// The boot protocol's actions, with a context like the execute protocol's
// (reads from the repository, writes collected, then committed; exec.commit()
// a local commit). A parent built with its packages manifest naming the
// store; the child deployed from a target package's list, inside the parent.
import test from 'brittle'
import fs, { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, statSync } from 'bare-fs'
import crypto from 'bare-crypto'
import { join } from 'bare-path'
import { tmpdir } from 'bare-os'
import Bundle from 'bare-bundle'
import { openRepo, writer, p2pgitBackend } from 'mycelium-git'
import { record, drop, nameOf, layer, outboxOf } from 'mrepo-base-request'
import { ask } from 'mrepo-base-runtime'
import { spawn, spawnSync } from 'bare-subprocess'
import process from 'bare-process'
import { registry } from 'mycelium-value-avro'
import { build, deploy, teardown, redeploy, place, parseSource, lay, schemasOf } from '../index.js'

const lj = (dir, mode) => { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, '.layer.json'), JSON.stringify({ mode, description: 'test' })) }
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

test('documents: store: the list laid in and placed, nothing more: its info extraction reads the store; documents anything else refused', async (t) => {
  const pkgs = mkdtempSync(join(tmpdir(), 'documents-src-'))
  const into = mkdtempSync(join(tmpdir(), 'documents-into-'))
  const dir = mkdtempSync(join(tmpdir(), 'documents-dir-'))
  const store = mkdtempSync(join(tmpdir(), 'documents-store-'))
  try {
    source(pkgs, {
      'haiccing/base': { 'runtime/.layer.json': { mode: 'atomic' } },
      'haiccing/other': { 'other/.layer.json': { mode: 'atomic' } },
      'haiccing/docs': { 'packages/.layer.json': { mode: 'replicated', packages: ['haiccing/base', 'haiccing/docs'], documents: 'store' } },
      'haiccing/odd': { 'packages/.layer.json': { mode: 'replicated', packages: ['haiccing/odd'], documents: 'sources' } }
    })
    const sources = [parseSource(`folder:${pkgs}`)]
    const { list } = lay({ store, sources, target: 'haiccing/docs', into })
    t.alike(list, ['haiccing/base', 'haiccing/docs'], 'the list')
    t.absent(existsSync(join(store, 'haiccing', 'other.bundle')), 'nothing beyond it fetched')
    t.exception(() => lay({ store, sources, target: 'haiccing/odd', into }), /haiccing\/odd: documents what\? sources \(store\)/, 'documents anything but store: refused')
    lj(join(dir, 'packages'), 'replicated')
    const { dir: built } = await build({ from: dir, work: store, name: 'docs' })
    const { packages } = await place({ dir: built, store, sources, list })
    t.alike(Object.keys(packages), list, 'the list placed, nothing more')
  } finally { for (const d of [pkgs, into, dir, store]) rmSync(d, { recursive: true, force: true }) }
})

test('schemas: each package placed registers the schemas it carries, its own and its modules\', in the install\'s registry', async (t) => {
  const pkgs = mkdtempSync(join(tmpdir(), 'schemas-src-'))
  const store = mkdtempSync(join(tmpdir(), 'schemas-store-'))
  const dir = mkdtempSync(join(tmpdir(), 'schemas-dir-'))
  try {
    const answer = { type: 'record', name: 'haiccing.base.answer', fields: [{ name: 'a', type: 'string' }] }
    const inner = { type: 'record', name: 'pearFullSquare.someModule.thing', fields: [{ name: 'n', type: 'long' }] }
    source(pkgs, {
      'haiccing/base': { 'runtime/.layer.json': { mode: 'atomic' }, '/schemas/answer.json': answer, '/modules/pear-full-square/some-module/schemas/thing.json': inner, '/schemas/README.md': '# not one' },
      'haiccing/bad': { '/schemas/bad.json': { type: 'record', name: 'X', fields: [{ name: 'a', type: 'nope' }] } }
    })
    const sources = [parseSource(`folder:${pkgs}`)]
    lj(join(dir, 'packages'), 'replicated')
    const { dir: built } = await build({ from: dir, work: store, name: 'base' })
    const { schemas } = await place({ dir: built, store, sources, list: ['haiccing/base'] })
    t.alike(schemas['haiccing/base'].map(s => s.uri), ['pear-full-square/some-module/thing', 'haiccing/base/answer'], 'its modules\' and its own, by URI')
    t.ok(schemas['haiccing/base'].every(s => s.added && /^[0-9a-f]{16}$/.test(s.fingerprint)), 'each by its fingerprint')
    const reg = registry(schemasOf(store))
    t.is(reg.named('haiccing/base/answer').length, 1, 'in the install\'s registry, read by another')
    const again = await place({ dir: built, store, sources, list: ['haiccing/base'] })
    t.absent(again.schemas['haiccing/base'].some(s => s.added), 'placed again: the same entries')
    await t.exception(place({ dir: built, store, sources, list: ['haiccing/bad'] }), /not a schema: haiccing\/bad \/schemas\/bad.json/, 'not valid AVRO: said, with where')
  } finally { for (const d of [pkgs, store, dir]) rmSync(d, { recursive: true, force: true }) }
})

test('deploy from a target package\'s list, linked first, placed by its unique URI, its scripts placed; idempotent; redeploy; teardown; the registry, mrepos/; a swarm\'s node', async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'deploy-'))
  const pkgs = mkdtempSync(join(tmpdir(), 'deploy-src-'))
  try {
    source(pkgs, {
      'haiccing/base': { 'runtime/.layer.json': { mode: 'atomic' }, 'runtime/kind.json': { kind: 'base' }, 'runtime/hooks/boot/base.json': ['x/y'], 'inbox/.layer.json': { mode: 'non-atomic' } },
      'haiccing/target': { '/scripts/hello.haicc': 'crud/read .\n', 'main/.layer.json': { mode: 'atomic' }, 'runtime/kind.json': { kind: 'target' }, 'packages/.layer.json': { mode: 'replicated', packages: ['haiccing/base', 'haiccing/target'] } }
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
    exec.entries = []
    t.alike(await teardown(exec, { uri: ['main', 'nothing'] }), { tornDown: 'nothing', again: true }, 'nothing there at all: idempotent, allowed, nothing done')
    t.ok(exec.entries.some(e => e.level === 'warn' && e.event === 'not deployed' && e.at === 'nothing'), 'a warning: not deployed')
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
    t.ok(await child.read('/runtime/.layer.json').then(() => true, () => false), 'the runtime layer itself is structure: from whichever package brings it')
    t.alike(d.packages, ['haiccing/base', 'haiccing/target'], 'its packages, in order')
    t.is(statSync(join(work, 'packages', 'haiccing', 'base.bundle')).ino, statSync(join(host, 'packages', 'haiccing', 'base.bundle')).ino, 'each linked from the store')
    const [shortcut] = json(await repo.read('/main/host/.shortcuts.json'))
    t.alike([Object.keys(shortcut), shortcut.mrepo, /^[0-9a-f-]{36}$/.test(shortcut.link)], [['mrepo', 'link'], 'local/host', true], 'its shortcut, in main beside its node: a list, the mrepo linked there by its unique URI (in its parent\'s swarm) and the link\'s own key: what is needed to show it')
    t.alike(json(await repo.read('/main/host/.node.json')), {}, 'its node, in main: an empty document')
    t.alike(json(await repo.read(`/links/${shortcut.link}.json`)), { key: shortcut.link, uri: 'local/host', at: 'host', how: 'deployed', folder: '../local/host', package: 'haiccing/target', packages: d.packages, layers: d.layers, scripts: ['haiccing/target/hello'] }, 'what is local to this machine about it, its link\'s record in the links layer, by the link\'s key: which mrepo, the position that links to it, how it came about, where it is (from this mrepo\'s folder), what it came from, the scripts placed; main replicates, this does not')
    t.alike(d.scripts, ['haiccing/target/hello'], 'its packages\' scripts placed, said')
    t.is(readFileSync(join(work, 'scripts', 'haiccing', 'target', 'hello.haicc'), 'utf8'), 'crud/read .\n', 'in the work folder\'s scripts/, by package: <work>/scripts/<org>/<package>/<name>.haicc')
    t.alike([d.mrepo, d.package], ['local/host', 'haiccing/target'], 'both said in what deploy returns')
    t.alike(json(await child.read('/runtime/mrepo.json')), { uri: 'local/host' }, 'its identity, in its own runtime layer')
    exec.entries = []
    const again = await deploy(exec, { uri: ['main', 'host'], args: ['haiccing/target'] })
    t.alike([again.again, again.deployed, again.mrepo, again.package], [true, 'host', 'local/host', 'haiccing/target'], 'deployed again from the same package: idempotent, allowed, nothing done, what is there said')
    t.ok(exec.entries.some(e => e.level === 'warn' && e.event === 'deployed already'), 'a warning: deployed already')
    t.is((await deploy(exec, { uri: ['main', 'host'] })).again, true, 'no package given: the same')
    await t.exception(deploy(exec, { uri: ['main', 'host'], args: ['haiccing/base'] }), /deployed already: host, from haiccing\/target \(not haiccing\/base\)/, 'from another package: refused')

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
    t.alike([await repo.read('/main/host/.shortcuts.json').catch(() => null), await repo.read('/main/host/.node.json').catch(() => null), (await repo.select('/links/*')).filter(([p]) => !p.endsWith('.layer.json')).length], [null, null, 0], 'its shortcut and its node out of main, what was local out of the runtime layer')
    t.is((await teardown(exec, { uri: ['main', 'host'] })).again, true, 'torn down again: idempotent, allowed')
    t.ok(existsSync(join(work, 'scripts', 'haiccing', 'target', 'hello.haicc')), 'the scripts placed stay: the install\'s')
    // the registry: the work folder's mrepos/, its folders by unique URI; nothing in main
    for (const n of ['one', 'two', 'three']) { await deploy(exec, { uri: ['main', n], args: ['haiccing/target'] }); await commit() }
    t.alike(readdirSync(join(work, 'mrepos', 'local')).sort(), ['one', 'three', 'two'], 'three deployed: three folders in mrepos/, by unique URI: the registry')
    t.absent(await repo.find('/main/registry/.node.json'), 'no registry in main')
    for (const n of ['one', 'two', 'three']) { await teardown(exec, { uri: ['main', n] }); await commit() }
    t.alike(readdirSync(join(work, 'mrepos', 'local')), [], 'torn down: out of the registry')
    // linked first, undone on a failure: nothing of it left, its link out again
    await t.exception(deploy(exec, { uri: ['main', 'x'], args: ['haiccing/none'] }), /not in the store nor the sources/)
    await commit()
    t.alike([await repo.find('/main/x/.node.json'), await repo.find('/main/x/.shortcuts.json'), (await repo.select('/links/*')).filter(([p]) => !p.endsWith('.layer.json')).length, existsSync(join(work, 'mrepos', 'local', 'x'))], [null, null, 0, false], 'a deploy that failed: its link out again, nothing built')
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
    t.is((await deploy(exec, { uri: ['main', 'swarms/swarm-1/node-1'], args: ['haiccing/target'] })).again, true, 'again: deployed already')
    t.alike(await teardown(exec, { uri: ['main', 'swarms/swarm-1/node-1'] }), { tornDown: 'swarms/swarm-1/node-1' }, 'torn down at its position')
    await commit()
    t.alike([existsSync(join(work, 'mrepos', 'swarm-1', 'node-1')), await repo.find('/main/swarms/swarm-1/node-1/.node.json'), json(await repo.read('/main/swarms/swarm-1/.node.json'))], [false, null, { kind: 'swarm' }], 'gone, its swarm\'s node left')
    // a howtos node: the root of a namespace, the path below it the unique URI
    exec.put('/main/howtos/.node.json', Buffer.from('{"kind":"howtos"}\n'))
    for (const p of ['haiccing', 'haiccing/base-package-crud', 'haiccing/base-package-crud/howto', 'haiccing/base-package-crud/howto/query']) exec.put(`/main/howtos/${p}/.node.json`, Buffer.from('{}\n'))
    await commit()
    const h = await deploy(exec, { uri: ['main', 'howtos/haiccing/base-package-crud/howto/query/boot'], args: ['haiccing/target'] })
    await commit()
    const HOWTO = 'haiccing/base-package-crud/howto/query'
    t.alike([h.deployed, h.mrepo], ['howtos/' + HOWTO + '/boot', HOWTO + '/boot'], 'below a howtos node: its unique URI the path below it, a how-to\'s key and its name')
    t.ok(existsSync(join(work, 'mrepos', ...HOWTO.split('/'), 'boot', '.git')), 'placed by it: <work>/mrepos/' + HOWTO + '/boot')
    t.alike(json(await openRepo(p2pgitBackend(join(work, 'mrepos', ...HOWTO.split('/'), 'boot', '.git'), { fs })).read('/runtime/mrepo.json')), { uri: HOWTO + '/boot' }, 'its identity, the path')
    // the rule: a unique URI never a prefix of another's
    await t.exception(deploy(exec, { uri: ['main', 'howtos/haiccing/base-package-crud/howto'], args: ['haiccing/target'] }), /exists locally/, 'a namespace\'s node: data, no target')
    exec.put('/main/plain2/.node.json', Buffer.from('{}\n'))
    exec.put('/main/plain2/q/.node.json', Buffer.from('{"kind":"howtos"}\n'))
    exec.put('/main/plain2/q/haiccing/.node.json', Buffer.from('{}\n'))
    exec.put('/main/plain2/q/haiccing/base-package-crud/.node.json', Buffer.from('{}\n'))
    exec.put('/main/plain2/q/haiccing/base-package-crud/howto/.node.json', Buffer.from('{}\n'))
    exec.put('/main/plain2/q/haiccing/base-package-crud/howto/query/.node.json', Buffer.from('{}\n'))
    exec.put('/main/plain2/q/haiccing/base-package-crud/howto/query/boot/.node.json', Buffer.from('{}\n'))
    exec.put('/main/other/.node.json', Buffer.from('{"kind":"howtos"}\n'))
    exec.put('/main/other/haiccing/.node.json', Buffer.from('{}\n'))
    exec.put('/main/plain2/q/local/.node.json', Buffer.from('{}\n'))
    await commit()
    await t.exception(deploy(exec, { uri: ['main', 'plain2/q/haiccing/base-package-crud/howto/query/boot/inner'], args: ['haiccing/target'] }), /a unique URI is never a prefix of another's: haiccing\/base-package-crud\/howto\/query\/boot is haiccing\/base-package-crud\/howto\/query\/boot\/inner's/, 'an mrepo above it: refused, the two said')
    await t.exception(deploy(exec, { uri: ['main', 'other/haiccing/base-package-crud'], args: ['haiccing/target'] }), /a unique URI is never a prefix of another's: haiccing\/base-package-crud is haiccing\/base-package-crud\/howto\/query\/boot's/, 'an mrepo below it: refused, the one found said')
    t.absent(existsSync(join(work, 'mrepos', ...HOWTO.split('/'), 'boot', 'inner')), 'nothing built inside another\'s folder')
    await t.exception(deploy(exec, { uri: ['main', 'plain2/q/boot'], args: ['haiccing/target'] }), /not a unique URI: boot \(a namespace and a name at least/, 'one name: no unique URI')
    await t.exception(deploy(exec, { uri: ['main', 'plain2/q/local/x'], args: ['haiccing/target'] }), /not a unique URI: local\/x/, 'local: the namespace of what is in none')
    t.alike(await teardown(exec, { uri: ['main', 'howtos/' + HOWTO + '/boot'] }), { tornDown: 'howtos/' + HOWTO + '/boot' }, 'a how-to\'s mrepo torn down at its position')
    await commit()
    t.absent(existsSync(join(work, 'mrepos', ...HOWTO.split('/'), 'boot')), 'its folder gone')
    // a swarm in a how-to's namespace: in it, the swarm's name behind it
    const inner = { ...exec, runtime: { ...exec.runtime, uri: HOWTO + '/host' } }
    exec.put('/main/swarms/swarm-2/.node.json', Buffer.from('{"kind":"swarm"}\n'))
    await commit()
    const s2 = await deploy(inner, { uri: ['main', 'swarms/swarm-2/node-1'], args: ['haiccing/target'] })
    await commit()
    t.is(s2.mrepo, HOWTO + '/swarm-2/node-1', 'deployed by an mrepo in a namespace: its swarm\'s nodes in that namespace')
    t.ok(existsSync(join(work, 'mrepos', ...HOWTO.split('/'), 'swarm-2', 'node-1', '.git')), 'placed by it')
    await teardown(inner, { uri: ['main', 'swarms/swarm-2/node-1'] })
    await commit()
    await t.exception(deploy(exec, { uri: 'main/host', args: ['haiccing/target'] }), /not a URI: its segments, an array/, 'a URI as one string: not a form\'s')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(pkgs, { recursive: true, force: true })
  }
})

// The runtime's bundle as a sources folder holds it (the packages'
// build); the test skipped without.
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
    // (dropped as everyone drops a record: its offset given as it arrives)
    const sent = drop(host, 'local/host', record('/test', ['info/get']))
    const child = openRepo(p2pgitBackend(join(host, '.git'), { fs }))
    let back = null
    for (let i = 0; i < 100 && !back; i++) { back = await layer({ repo: child }, 'outbox').read(nameOf(sent)).catch(() => null); if (!back) await new Promise(resolve => setTimeout(resolve, 100)) }
    t.ok(back?.value.value.output?.choices?.[0]?.title, `its inbox operational: its boot hooks run (info activated, extracted), a request answered ${back?.value.value.error ?? ''}`)
    let inFolder = null
    for (let i = 0; i < 50 && !inFolder; i++) { inFolder = outboxOf(host).has(sent) ? outboxOf(host).read(sent) : null; if (!inFolder) await new Promise(resolve => setTimeout(resolve, 100)) }
    t.alike(inFolder?.value.value, back.value.value, 'and in its outbox folder, as committed (for a subscriber)')
    await teardown(exec, { uri: ['main', 'host'] })
    await commit()
    t.is(await ask({ repo: host, op: 'status' }), null, 'teardown: its runtime stopped')
    t.absent(spawnSync('kill', ['-0', String(d.runtime.pid)], { stdio: 'ignore' }).status === 0, 'its process ended')
    t.absent(existsSync(host), 'and removed')
  } finally { rmSync(work, { recursive: true, force: true }) }
})

test('commission and decommission: the deploy waits for the child\'s commission, a failed one leaving nothing; the teardown asks for its decommission first, a failed one removing nothing', { timeout: 120000, skip: !haveRuntime }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'deploy-cm-'))
  const pkgs = mkdtempSync(join(tmpdir(), 'deploy-cm-src-'))
  const alive = pid => spawnSync('kill', ['-0', String(pid)], { stdio: 'ignore' }).status === 0
  try {
    // packages on the runtime alone, each its hooks: lines of the protocols the runtime brings
    const on = hooks => ({ 'main/.layer.json': { mode: 'atomic' }, ...Object.fromEntries(Object.entries(hooks).map(([h, text]) => [`runtime/hooks/${h}.haicc`, text])) })
    source(pkgs, {
      'haiccing/good': { ...on({ commission: 'protocol/activate . info\n', decommission: 'protocol/deactivate . info\n' }), 'packages/.layer.json': { mode: 'replicated', packages: ['haiccing/base-package-runtime', 'haiccing/base-package-protocol', 'haiccing/base-package-info', 'haiccing/good'] } },
      'haiccing/bad': { ...on({ commission: 'protocol/activate . info\nnope/nothing\n' }), 'packages/.layer.json': { mode: 'replicated', packages: ['haiccing/base-package-runtime', 'haiccing/base-package-protocol', 'haiccing/base-package-info', 'haiccing/bad'] } },
      'haiccing/stuck': { ...on({ decommission: 'nope/nothing\n' }), 'packages/.layer.json': { mode: 'replicated', packages: ['haiccing/base-package-runtime', 'haiccing/base-package-protocol', 'haiccing/base-package-info', 'haiccing/stuck'] } }
    })
    const dir = await parent(work, [parseSource(`folder:${pkgs}`), parseSource(`folder:${SOURCES}`)])
    const { exec, commit } = context(dir, p2pgitBackend(join(dir, '.git'), { fs }), work)
    const good = await deploy(exec, { uri: ['main', 'good'], args: ['haiccing/good'] })
    await commit()
    t.is(good.commission, 'done', 'its commission done before the deploy answers: said')
    t.ok(exec.entries.some(e => e.event === 'commission' && e.state === 'done'), 'a step of the deploy, logged')
    t.alike((await ask({ repo: join(work, 'mrepos', 'local', 'good'), op: 'status' }))?.commission, { state: 'done' }, 'in the child\'s status')
    exec.entries = []
    t.alike(await teardown(exec, { uri: ['main', 'good'] }), { tornDown: 'good' })
    await commit()
    t.ok(exec.entries.some(e => e.event === 'decommission' && e.decommission === 'done'), 'its decommission first: done, logged')
    await t.exception(deploy(exec, { uri: ['main', 'bad'], args: ['haiccing/bad'] }), /its commission failed: line 2: nope\/nothing: .*nothing of it left/, 'a commission that fails: the deploy fails, the line said')
    t.absent(existsSync(join(work, 'mrepos', 'local', 'bad')), 'nothing of it left: its folder gone')
    t.absent(await ask({ repo: join(work, 'mrepos', 'local', 'bad'), op: 'status' }), 'its runtime stopped')
    const stuck = await deploy(exec, { uri: ['main', 'stuck'], args: ['haiccing/stuck'] })
    await commit()
    t.is(stuck.commission, 'none', 'no commission hook: none')
    await t.exception(teardown(exec, { uri: ['main', 'stuck'] }), /not torn down: stuck: its decommission: line 1: nope\/nothing/, 'a decommission that fails: the teardown refused, the line said')
    t.ok(existsSync(join(work, 'mrepos', 'local', 'stuck', '.git')) && alive(stuck.runtime.pid), 'nothing removed: its folder, its runtime')
    await ask({ repo: join(work, 'mrepos', 'local', 'stuck'), op: 'stop' })
    for (let i = 0; i < 100 && alive(stuck.runtime.pid); i++) await new Promise(resolve => setTimeout(resolve, 100))
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(pkgs, { recursive: true, force: true })
  }
})
