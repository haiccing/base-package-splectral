// child(exec, uri): the child mrepo a boot action names; shared by the
// actions (not documented: a helper). Async: a position's meaning comes
// from the documents of the nodes above it.
//   uri       the request's, its segments: ['main', '<position>'], any
//             position below main, a target needed
//   at        its position as written at main: <name>, a/b/<name>
//             (the node above it there already: above() throws when not)
//   name      its own name: the last of its position
//   swarmAt   the node above it whose document says it is a swarm
//             ({ "kind": "swarm" }), the nearest; null: none
//   dir       its folder: by its unique URI, side by side with the others
//             under the work folder's mrepos/: <work>/mrepos/<swarm>/<name>
//   folder    the same, relative to this mrepo's own folder
//   node      its node's document, in main: main/<at>/.node.json
//   links     its shortcuts, in main beside it: main/<at>/.shortcuts.json,
//             a list; the child is one entry, { mrepo, link }: what is
//             needed to show the link: which mrepo, and the link's key
//   local     what is local to this machine about it (where it is, the
//             position that links to it, how it came about, the package
//             it was deployed from, the packages placed, its layers, its
//             runtime's process): its link's record in the links layer,
//             by the link's key: links/<key>.json (local(key): its path);
//             main replicates, this does not
//   registry  its node in the mrepo registry, in main, by its unique URI:
//             main/registry/<swarm>/<name>/.node.json (swarm: its
//             swarm's node above it); written where registers() says
//             this mrepo keeps one: the boot mrepo
//   mrepo     its unique URI, <swarm>/<name>: in the swarm of the nearest
//             node above it that is one, by that node's name
//             (swarms/swarm-1 a swarm: swarms/swarm-1/node-1 is
//             swarm-1/node-1); none: in its parent's swarm (local/host)
//   recorded  its link and what is local, as one record; null: not deployed
//   exists    whether a node is there already without being this link:
//             data in main at that position. The boot protocol cannot
//             target that: refuse() throws then
// A target is needed: main itself, or the root, is the mrepo, which one
// cannot deploy or tear down. A position below a shortcut is another
// mrepo's: refused.
import { join, dirname, relative } from 'bare-path'
import { segmented, joined, within, ROOT } from 'mycelium-uri'
import { MREPOS } from 'mrepo-base-request'
import { shortcutOf, shortcutsAt, linked, linkPath, registryOf, uriOf, REGISTRY, LOCAL } from 'mrepo-base-xpath'

export const NODE = '.node.json'
// What a node's document says it is: { "kind": "swarm" }, a swarm.
export const KIND = 'kind'
export const SWARM = 'swarm'
const NAME = /^[a-z][a-z0-9-]*$/

export async function child (exec, segments) {
  if (segments === undefined || segmented(segments).at(-1) === ROOT) throw new Error('missing argument: target')
  const uri = joined(segments)
  if (uri === 'main') throw new Error('missing argument: target')
  const at = within('main', uri)
  if (at === null) throw new Error(`not a position in main: ${uri} (main/<name>)`)
  const names = at.split('/')
  if (!names.every(n => NAME.test(n))) throw new Error(`not a position for an mrepo: ${at} (names of lowercase letters, digits, hyphens)`)
  // the nodes above it, nearest first: none a shortcut; the nearest swarm
  let swarmAt = null
  for (let i = names.length - 1; i >= 1; i--) {
    const above = names.slice(0, i).join('/')
    if ((await shortcutsAt(exec, above)).length) throw new Error(`${above} is a shortcut: a URI does not run through it (haicc ${above} ...)`)
    if (swarmAt === null) {
      const doc = await exec.find(`main/${above}/${NODE}`)
      let value = null
      // catch: a document that is no JSON says nothing about its kind
      try { value = doc === null ? null : JSON.parse(doc.toString()) } catch {}
      if (value && value[KIND] === SWARM) swarmAt = above
    }
  }
  const swarm = swarmAt === null ? null : swarmAt.split('/').pop()
  // (local: the swarm of what is not in one)
  if (swarm === LOCAL) throw new Error(`not a swarm: ${LOCAL} (the mrepos in no swarm; ${swarmAt})`)
  const name = names.at(-1)
  const parent = names.length > 1 ? names.slice(0, -1).join('/') : null
  const dir = exec.runtime.dir
  if (!dir) throw new Error('no directory in the context')
  const mrepo = swarm ? `${swarm}/${name}` : uriOf(exec.runtime.uri, name)
  // placed by its unique URI, side by side with the others under the work
  // folder's mrepos/ (beside its parent, where there is no work folder)
  const placed = join(exec.runtime.work ? join(exec.runtime.work, MREPOS) : dirname(dir), mrepo)
  const shortcut = async () => (await shortcutsAt(exec, at)).find(l => l.mrepo === mrepo) ?? null
  const exists = async () => (await exec.select(`main/${at}`)).length > 0 && !(await shortcut())
  exec.log('debug', 'child', { at, mrepo, dir: placed })
  return {
    name,
    at,
    // the node above it is there (made first: crud/create)
    above: async () => { if (parent && await exec.find(`main/${parent}/${NODE}`) === null) throw new Error(`no node there: ${parent} (crud/create ${parent})`) },
    swarmAt,
    dir: placed,
    // (as its link's record says it: relative to this mrepo's own folder)
    folder: relative(dir, placed),
    node: `main/${at}/${NODE}`,
    links: shortcutOf(at),
    local: linkPath,
    mrepo,
    // (the mrepo registry: there where main has the node `registry`: the boot mrepo)
    registry: `${registryOf(mrepo)}/${NODE}`,
    swarm: `${registryOf(mrepo.split('/')[0])}/${NODE}`,
    registers: async () => (await exec.find(`main/${REGISTRY}/${NODE}`)) !== null,
    recorded: async () => { const l = await shortcut(); return l ? { ...l, ...(await linked(exec, l.link) ?? {}) } : null },
    exists,
    refuse: async () => { if (await exists()) throw new Error(`${at} exists locally: the boot protocol cannot target it`) }
  }
}
