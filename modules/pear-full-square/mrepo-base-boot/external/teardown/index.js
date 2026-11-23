// teardown(exec, { uri }): the boot protocol's teardown (README.md beside it).
import { rmSync } from 'bare-fs'
import { stop, decommission } from 'mrepo-base-runtime'
import { child } from '../../internal/child.js'
import { teardownPair } from '../../internal/pair/index.js'

export async function teardown (exec, { uri }) {
  const c = await child(exec, uri)
  const recorded = await c.recorded()
  // Idempotent: not deployed (torn down already): allowed, a warning,
  // nothing done. Data at the position: not the boot protocol's, refused.
  if (!recorded) {
    await c.refuse()
    exec.log('warn', 'not deployed', { at: c.at })
    return { tornDown: c.at, again: true }
  }
  // A pair: torn down by the container's platform, the container and its
  // folder removed (internal/pair); this host never stops its runtime.
  // Else its runtime stopped first (when it runs), waited for until its
  // process has ended (mrepo-base-runtime's stop: asked, then SIGTERM, then
  // SIGKILL), and its folder removed.
  // Its decommission first, by its runtime (a pair's: by the container's
  // platform, its own teardown): what the mrepo does before it goes, what
  // it deployed torn down. A line that fails stops the teardown, nothing
  // removed. Its runtime not answering: nothing to ask, torn down all the same.
  if (recorded.how !== 'container') {
    const d = await exec.step('decommission', r => ({ decommission: r?.decommission ?? null, ...(r?.error ? { error: r.error } : {}) }), () => decommission({ repo: c.dir }))
    if (d && !d.ok) throw new Error(`not torn down: ${c.at}: its ${d.error}`)
  }
  const pair = recorded.how === 'container' ? await teardownPair(exec, c, recorded) : null
  const stopped = pair ? null : await exec.step('runtime', r => ({ pid: recorded.runtime?.pid ?? null, stopped: r ?? null }), () => stop({ repo: c.dir, pid: recorded.runtime?.pid }))
  if (!pair) await exec.step('folder', { dir: c.dir }, async () => rmSync(c.dir, { recursive: true, force: true }))
  // its link, the node it was made at, and what was local about it
  exec.remove(c.links)
  exec.remove(c.node)
  if (recorded.link && await exec.find(c.local(recorded.link)) !== null) exec.remove(c.local(recorded.link))
  exec.log('info', 'torn down', { at: c.at, mrepo: c.mrepo, runtime: stopped ?? null, ...(pair ? { container: pair.container } : {}) })
  return pair ? { tornDown: c.at, container: pair.container } : { tornDown: c.at }
}
