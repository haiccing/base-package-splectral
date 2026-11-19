// deploy(exec, { uri, args: [package] }): the boot protocol's deploy (README.md beside it).
import { existsSync } from 'bare-fs'
import { join } from 'bare-path'
import { start } from 'mrepo-base-runtime'
import { guid } from 'mrepo-base-request'
import { fetch, scriptOf, scriptsOf } from '../../internal/fetch/index.js'
import { install, origin, targetOf } from '../../internal/install/index.js'
import { child } from '../../internal/child.js'
import { deployPair } from '../../internal/pair/index.js'

// (link: the key of the link, when it has one already: a redeploy keeps it)
export async function deploy (exec, { uri, args = [], flags = {} }, { link: kept = null } = {}) {
  const c = await child(exec, uri)
  if (await c.recorded()) throw new Error(`deployed already: ${c.at}`)
  // a position that exists locally (data in main there): not a target
  await c.refuse()
  await c.above()
  // into a container (the flag: container): its own haicc install there
  // runs it, this mrepo links it (internal/pair)
  const pair = flags.container === true
  if (!pair && existsSync(c.dir)) throw new Error(`in the way: ${c.dir}`)
  if (!args[0]) throw new Error('missing argument: package')
  const target = targetOf(args[0])
  // The store and the sources: the mapping the parent's packages manifest records.
  const { store, sources } = await origin(exec)
  // A continuation asked for (the flag: continuation=<script>): a script
  // of the package deployed, by its name, answered with the deploy for
  // who asked to go on with, run at the deployed mrepo's position (sent
  // on as haicc/script). One that is not there: refused, before anything
  // is built.
  const script = typeof flags.continuation === 'string' ? flags.continuation : null
  if (script) fetch({ store, sources, pkg: target })
  const text = script ? scriptOf({ store, pkg: target, name: script }) : null
  if (script && text === null) throw new Error(`no script: ${script} (${target} has ${scriptsOf({ store, pkg: target }).join(', ') || 'none'})`)
  const link = kept ?? guid()
  // A pair: the container made, the child deployed in it by its own
  // platform; here only its link, as below, its folder the one in the
  // container's home that this host forwards to.
  if (pair) {
    const { folder, ...made } = await deployPair(exec, c, { target, sources })
    const entry = () => ({ key: link, uri: c.mrepo, at: c.at, how: 'container', folder, package: target, ...made })
    exec.put(c.node, Buffer.from('{}\n'))
    exec.put(c.links, Buffer.from(JSON.stringify([{ mrepo: c.mrepo, link }], null, 2) + '\n'))
    exec.put(c.local(link), Buffer.from(JSON.stringify(entry(), null, 2) + '\n'))
    if (await c.registers()) {
      if (await exec.find(c.swarm) === null) exec.put(c.swarm, Buffer.from('{}\n'))
      exec.put(c.registry, Buffer.from(JSON.stringify(entry(), null, 2) + '\n'))
    }
    if (text) { exec.continuation(text, c.at); exec.log('verbose', 'continuation', { script, bytes: Buffer.byteLength(text) }) }
    exec.log('info', 'deployed', { at: c.at, mrepo: c.mrepo, package: target, container: made.container.name })
    return { deployed: c.at, mrepo: c.mrepo, package: target, container: made.container }
  }
  // The target's list laid in, built at its own place, by its unique URI,
  // its packages placed.
  const record = await install(exec, { store, sources, target, dir: c.dir, uri: c.mrepo })
  // What is local to this machine about it (not in main, which replicates):
  // its link's record says besides which mrepo, linked where, how, placed where.
  const entry = () => ({ key: link, uri: c.mrepo, at: c.at, how: 'deployed', folder: c.folder, ...record })
  // Its runtime started, from its own packages/ (its pinned runtime), by
  // its directory: its inbox operational. Not when it has no runtime.
  const runtime = join(c.dir, 'packages', 'haiccing', 'base-package-runtime.bundle')
  if (existsSync(runtime)) {
    const s = await exec.step('runtime', r => ({ started: Boolean(r), pid: r?.pid ?? null }), () => start({ repo: c.dir, bundle: runtime }))
    if (!s) throw new Error(`its runtime did not start: ${c.dir}`)
    record.runtime = { pid: s.pid }
  } else exec.log('verbose', 'no runtime', { package: target })
  // Its node, in main, and beside it its shortcuts: which mrepo, and the
  // link's key: what is needed to show it. The rest in the links layer.
  exec.put(c.node, Buffer.from('{}\n'))
  exec.put(c.links, Buffer.from(JSON.stringify([{ mrepo: c.mrepo, link }], null, 2) + '\n'))
  exec.put(c.local(link), Buffer.from(JSON.stringify(entry(), null, 2) + '\n'))
  // The mrepo registry, where this mrepo keeps one (the boot mrepo): the
  // mrepo's node there, by its unique URI, with the same record.
  if (await c.registers()) {
    if (await exec.find(c.swarm) === null) exec.put(c.swarm, Buffer.from('{}\n'))
    exec.put(c.registry, Buffer.from(JSON.stringify(entry(), null, 2) + '\n'))
  }
  if (text) { exec.continuation(text, c.at); exec.log('verbose', 'continuation', { script, bytes: Buffer.byteLength(text) }) }
  exec.log('info', 'deployed', { at: c.at, mrepo: c.mrepo, package: target })
  return { deployed: c.at, mrepo: c.mrepo, ...record }
}
