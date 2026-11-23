// deploy(exec, { uri, args: [package] }): the boot protocol's deploy (README.md beside it).
import fs, { existsSync, rmSync } from 'bare-fs'
import { openRepo, p2pgitBackend } from 'mycelium-git'
import { join } from 'bare-path'
import { start, stop, commissioned, decommission } from 'mrepo-base-runtime'
import { guid, SCRIPTS } from 'mrepo-base-request'
import { install, origin, targetOf } from '../../internal/install/index.js'
import { placeScripts } from '../../internal/fetch/index.js'
import { child } from '../../internal/child.js'
import { deployPair } from '../../internal/pair/index.js'

// (link: the key of the link, when it has one already: a redeploy keeps it)
export async function deploy (exec, { uri, args = [], flags = {} }, { link: kept = null } = {}) {
  const c = await child(exec, uri)
  // Idempotent: deployed already from the same package: allowed, a
  // warning, nothing done, answered with what is there. Another package
  // there: refused.
  const was = await c.recorded()
  if (was) {
    const asked = args[0] ? targetOf(args[0]) : was.package
    if (asked !== was.package) throw new Error(`deployed already: ${c.at}${was.package ? `, from ${was.package} (not ${asked})` : ''}`)
    exec.log('warn', 'deployed already', { at: c.at, mrepo: c.mrepo, package: was.package })
    const { key, uri: _, link: __, at, how, folder, ...rest } = was
    return { deployed: c.at, mrepo: c.mrepo, ...rest, again: true }
  }
  // a position that exists locally (data in main there): not a target
  await c.refuse()
  await c.above()
  // the rule: a unique URI never a prefix of another's
  await c.free()
  // into a container (the flag: container): its own haicc install there
  // runs it, this mrepo links it (internal/pair)
  const pair = flags.container === true
  if (!pair && existsSync(c.dir)) throw new Error(`in the way: ${c.dir}`)
  if (!args[0]) throw new Error('missing argument: package')
  const target = targetOf(args[0])
  // The store and the sources: the mapping the parent's packages manifest records.
  const { store, sources } = await origin(exec)
  const link = kept ?? guid()
  // The link first, in this mrepo, committed: its node, its shortcut (which
  // mrepo, the link's key) and the link's record. From now on the child is
  // known here and reachable at its position, while it is built and
  // commissioned; what is learned on the way is added to its record.
  const record = { key: link, uri: c.mrepo, at: c.at, how: pair ? 'container' : 'deployed', folder: pair ? null : c.folder, package: target }
  const write = () => exec.put(c.local(link), Buffer.from(JSON.stringify(record, null, 2) + '\n'))
  exec.put(c.node, Buffer.from('{}\n'))
  exec.put(c.links, Buffer.from(JSON.stringify([{ mrepo: c.mrepo, link }], null, 2) + '\n'))
  write()
  await exec.commit?.('linked')
  // Undone on a failure: the link out again, committed (what was built: its
  // own undoing, below).
  const unlink = async () => {
    exec.remove(c.links)
    exec.remove(c.node)
    exec.remove(c.local(link))
    await exec.commit?.('unlinked')
  }
  try {
    // A pair: the container made, the child deployed in it by its own
    // platform (its commission there); here its link, its folder the one
    // in the container's home that this host forwards to.
    if (pair) {
      const { folder, ...made } = await deployPair(exec, c, { target, sources })
      Object.assign(record, { folder, ...made })
      write()
      exec.log('info', 'deployed', { at: c.at, mrepo: c.mrepo, package: target, container: made.container.name })
      return { deployed: c.at, mrepo: c.mrepo, package: target, container: made.container }
    }
    // Built at its place, <work>/mrepos/<unique URI>, the target's list
    // laid in, its packages placed; each package's scripts placed in the
    // install's scripts folder, where the haicc command reads them.
    Object.assign(record, await install(exec, { store, sources, target, dir: c.dir, uri: c.mrepo }))
    if (exec.runtime.work) {
      const placed = await exec.step('scripts', r => ({ scripts: r }), async () => record.packages.flatMap(pkg => placeScripts({ store, pkg, into: join(exec.runtime.work, SCRIPTS) }).map(n => `${pkg}/${n}`)))
      if (placed.length) record.scripts = placed
    }
    write()
    // Its runtime started, from its own packages/ (its pinned runtime), by
    // its directory: it runs its boot hook, then its commission (what its
    // package does once deployed: its components deployed, its service
    // initialised, started), which the deploy waits for. Not when it has
    // no runtime.
    const runtime = join(c.dir, 'packages', 'haiccing', 'base-package-runtime.bundle')
    if (existsSync(runtime)) {
      const s = await exec.step('runtime', r => ({ started: Boolean(r), pid: r?.pid ?? null }), () => start({ repo: c.dir, bundle: runtime }))
      if (!s) throw new Error(`its runtime did not start: ${c.dir}`)
      record.runtime = { pid: s.pid }
      const done = await exec.step('commission', r => ({ state: r?.state ?? null, ...(r?.error ? { error: r.error } : {}) }), () => commissioned({ repo: c.dir }))
      if (!done || done.state === 'failed') throw new Error(`its commission failed: ${done?.error ?? 'its runtime gone'} (${target}, nothing of it left)`)
      record.commission = done.state
      // its service's state as its commission left it, said with the deploy
      // catch: no service state there: none to say
      record.service = await openRepo(p2pgitBackend(join(c.dir, '.git'), { fs })).read('/runtime/service.json').then(b => JSON.parse(b.toString()).state ?? null, () => null)
    } else exec.log('verbose', 'no runtime', { package: target })
    write()
  } catch (err) {
    // Nothing of it left: what it deployed so far decommissioned, as it can
    // be; its runtime stopped; its folder removed; its link out.
    await exec.step('undone', { dir: c.dir }, async () => {
      if (!pair) {
        // catch: what is left of it goes, whatever its decommission says
        await decommission({ repo: c.dir }).catch(() => null)
        // catch: and whatever its stop says
        await stop({ repo: c.dir, pid: record.runtime?.pid ?? null }).catch(() => null)
        rmSync(c.dir, { recursive: true, force: true })
      }
      await unlink()
    })
    throw err
  }
  exec.log('info', 'deployed', { at: c.at, mrepo: c.mrepo, package: target, commission: record.commission ?? null })
  const { key, at, how, folder, uri: _, ...out } = record
  return { deployed: c.at, mrepo: c.mrepo, ...out }
}
