// teardown(exec, { uri }): the boot protocol's teardown (README.md beside it).
import { rmSync } from 'bare-fs'
import { stop } from 'mrepo-base-runtime'
import { segmented, joined } from 'mycelium-uri'
import { query, REGISTRY, MAIN } from 'mrepo-base-xpath'
import { child } from '../../internal/child.js'
import { teardownPair } from '../../internal/pair/index.js'

// Several at once: a URI into the mrepo registry (main/registry/...: the
// boot mrepo's) selects mrepos there, by unique URI or by what their
// nodes say: each torn down at the position that links to it. -> a list
async function several (exec, uri) {
  const { found } = await query(exec, uri)
  const out = []
  for (const f of found) {
    // (an mrepo's node says where it is linked; a swarm's node above them does not)
    const at = f.kind === 'node' ? JSON.parse((await exec.find(`${MAIN}/${f.at}/.node.json`))?.toString() ?? '{}').at : null
    if (at) out.push(await teardown(exec, { uri: [MAIN, at] }))
  }
  exec.log('verbose', 'several', { uri: joined(uri), tornDown: out.length })
  return out
}
const inRegistry = uri => { const u = joined(segmented(uri)); return u === `${MAIN}/${REGISTRY}` || u.startsWith(`${MAIN}/${REGISTRY}/`) }

export async function teardown (exec, { uri }) {
  if (inRegistry(uri)) return several(exec, uri)
  const c = await child(exec, uri)
  const recorded = await c.recorded()
  if (!recorded) { await c.refuse(); throw new Error(`not deployed: ${c.at}`) }
  // A pair: torn down by the container's platform, the container and its
  // folder removed (internal/pair); this host never stops its runtime.
  // Else its runtime stopped first (when it runs), waited for until its
  // process has ended (mrepo-base-runtime's stop: asked, then SIGTERM, then
  // SIGKILL), and its folder removed.
  const pair = recorded.how === 'container' ? await teardownPair(exec, c, recorded) : null
  const stopped = pair ? null : await exec.step('runtime', r => ({ pid: recorded.runtime?.pid ?? null, stopped: r ?? null }), () => stop({ repo: c.dir, pid: recorded.runtime?.pid }))
  if (!pair) await exec.step('folder', { dir: c.dir }, async () => rmSync(c.dir, { recursive: true, force: true }))
  // its link, the node it was made at, and what was local about it
  exec.remove(c.links)
  exec.remove(c.node)
  if (recorded.link && await exec.find(c.local(recorded.link)) !== null) exec.remove(c.local(recorded.link))
  if (await exec.find(c.registry) !== null) exec.remove(c.registry)
  exec.log('info', 'torn down', { at: c.at, mrepo: c.mrepo, runtime: stopped ?? null, ...(pair ? { container: pair.container } : {}) })
  return pair ? { tornDown: c.at, container: pair.container } : { tornDown: c.at }
}
