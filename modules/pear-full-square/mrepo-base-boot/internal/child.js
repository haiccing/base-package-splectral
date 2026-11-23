// child(exec, uri): the child mrepo a boot action names; shared by the
// actions (not documented: a helper). Async: a position's meaning comes
// from the documents of the nodes above it.
//   uri       the request's, its segments: ['main', '<position>'], any
//             position below main, a target needed
//   at        its position as written at main: <name>, a/b/<name>
//             (the node above it there already: above() throws when not)
//   name      its own name: the last of its position
//   nsAt      the nearest node above it whose document says it is a
//             namespace ({ "kind": "swarm" }, { "kind": "howtos" }); null:
//             none
//   swarmAt   the same, when that namespace is a swarm; null otherwise
//   kind      that node's kind; null: none
//   dir       its folder: by its unique URI, side by side with the others
//             under the work folder's mrepos/: <work>/mrepos/<unique URI>
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
//   mrepo     its unique URI, a path: from the nearest namespace node
//             above it down to it. A swarm names its namespace by its own
//             name (swarms/swarm-1 a swarm: swarms/swarm-1/node-1 is
//             swarm-1/node-1); a howtos node is the root of one, the path
//             below it the URI (howtos a howtos node:
//             howtos/haiccing/base-package-crud/howto/query/boot is
//             haiccing/base-package-crud/howto/query/boot). In the
//             namespace this mrepo is in itself, when that is not local
//             (a how-to's host deploying a swarm: its swarm's nodes in
//             its namespace). None above it: in its parent's namespace
//             (local/host). Two segments at least, the first never local
//   recorded  its link and what is local, as one record; null: not deployed
//   exists    whether a node is there already without being this link:
//             data in main at that position. The boot protocol cannot
//             target that: refuse() throws then
//   free      the rule, at deploy: a unique URI is never a prefix of
//             another's, no mrepo's folder inside another's; free()
//             throws when one is: an mrepo's folder above it, or mrepos'
//             folders below it already (the folders under mrepos/ are
//             the install's registry; a plain folder in its place: in the
//             way, said by the deploy)
// A target is needed: main itself, or the root, is the mrepo, which one
// cannot deploy or tear down. A position below a shortcut is another
// mrepo's: refused.
import { existsSync, readdirSync, statSync } from 'bare-fs'
import { join, dirname, relative } from 'bare-path'
import { segmented, joined, within, ROOT } from 'mycelium-uri'
import { MREPOS } from 'mrepo-base-request'
import { shortcutOf, shortcutsAt, linked, linkPath, uriOf, namespaceOf, LOCAL } from 'mrepo-base-xpath'

export const NODE = '.node.json'
// What a node's document says it is: { "kind": "swarm" }, a swarm.
export const KIND = 'kind'
export const SWARM = 'swarm'
// The kinds that make a node a namespace, the root of unique URIs: by
// whether its own name is the namespace's first segment (a swarm's) or
// the path below it is the URI on its own (a how-to's unique key).
export const HOWTOS = 'howtos'
export const NAMESPACES = { [SWARM]: true, [HOWTOS]: false }
const NAME = /^[a-z][a-z0-9-]*$/

export async function child (exec, segments) {
  if (segments === undefined || segmented(segments).at(-1) === ROOT) throw new Error('missing argument: target')
  const uri = joined(segments)
  if (uri === 'main') throw new Error('missing argument: target')
  const at = within('main', uri)
  if (at === null) throw new Error(`not a position in main: ${uri} (main/<name>)`)
  const names = at.split('/')
  if (!names.every(n => NAME.test(n))) throw new Error(`not a position for an mrepo: ${at} (names of lowercase letters, digits, hyphens)`)
  // the nodes above it, nearest first: none a shortcut; the nearest namespace
  let nsAt = null
  let kind = null
  for (let i = names.length - 1; i >= 1; i--) {
    const above = names.slice(0, i).join('/')
    if ((await shortcutsAt(exec, above)).length) throw new Error(`${above} is a shortcut: a URI does not run through it (haicc ${above} ...)`)
    if (nsAt === null) {
      const doc = await exec.find(`main/${above}/${NODE}`)
      let value = null
      // catch: a document that is no JSON says nothing about its kind
      try { value = doc === null ? null : JSON.parse(doc.toString()) } catch {}
      if (value && Object.hasOwn(NAMESPACES, value[KIND])) { nsAt = above; kind = value[KIND] }
    }
  }
  const name = names.at(-1)
  const parent = names.length > 1 ? names.slice(0, -1).join('/') : null
  const dir = exec.runtime.dir
  if (!dir) throw new Error('no directory in the context')
  let mrepo
  if (nsAt === null) mrepo = uriOf(exec.runtime.uri, name)
  else {
    // the path from the namespace node down: a swarm's own name first
    const path = [...(NAMESPACES[kind] ? [nsAt.split('/').pop()] : []), ...names.slice(nsAt.split('/').length)]
    // (local: the namespace of what is in none)
    if (path[0] === LOCAL) throw new Error(kind === SWARM ? `not a swarm: ${LOCAL} (the mrepos in no swarm; ${nsAt})` : `not a unique URI: ${path.join('/')} (${LOCAL}: the mrepos in no namespace)`)
    // in this mrepo's own namespace, when it is in one
    const mine = namespaceOf(exec.runtime.uri)
    mrepo = [...(mine === LOCAL ? [] : [mine]), ...path].join('/')
    if (!mrepo.includes('/')) throw new Error(`not a unique URI: ${mrepo} (a namespace and a name at least: ${kind} ${nsAt}, then a/b)`)
  }
  // placed by its unique URI, side by side with the others under the work
  // folder's mrepos/ (beside its parent, where there is no work folder)
  const base = exec.runtime.work ? join(exec.runtime.work, MREPOS) : dirname(dir)
  const placed = join(base, ...mrepo.split('/'))
  const parts = mrepo.split('/')
  // what is above it in its unique URI: a/b/c's a and a/b
  const prefixes = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))
  // the rule: no unique URI a prefix of another's
  const free = async () => {
    const prefix = (a, b) => new Error(`a unique URI is never a prefix of another's: ${a} is ${b}'s (no mrepo's folder inside another's)`)
    for (const p of prefixes) if (existsSync(join(base, ...p.split('/'), '.git'))) throw prefix(p, mrepo)
    // an mrepo's folder below its place: the first found, its unique URI
    const below = at => {
      if (!existsSync(at) || !statSync(at).isDirectory()) return null
      for (const n of readdirSync(at).sort()) {
        const d = join(at, n)
        if (!statSync(d).isDirectory()) continue
        if (existsSync(join(d, '.git'))) return relative(base, d)
        const deeper = below(d)
        if (deeper) return deeper
      }
      return null
    }
    const other = existsSync(join(placed, '.git')) ? null : below(placed)
    if (other) throw prefix(mrepo, other)
    // (a folder in its place that holds no mrepo: in the way, said by the deploy)
  }
  const shortcut = async () => (await shortcutsAt(exec, at)).find(l => l.mrepo === mrepo) ?? null
  const exists = async () => (await exec.select(`main/${at}`)).length > 0 && !(await shortcut())
  exec.log('debug', 'child', { at, mrepo, dir: placed })
  return {
    name,
    at,
    // the node above it is there (made first: crud/create)
    above: async () => { if (parent && await exec.find(`main/${parent}/${NODE}`) === null) throw new Error(`no node there: ${parent} (crud/create ${parent})`) },
    nsAt,
    kind,
    swarmAt: kind === SWARM ? nsAt : null,
    dir: placed,
    // (as its link's record says it: relative to this mrepo's own folder)
    folder: relative(dir, placed),
    node: `main/${at}/${NODE}`,
    links: shortcutOf(at),
    local: linkPath,
    mrepo,
    recorded: async () => { const l = await shortcut(); return l ? { ...l, ...(await linked(exec, l.link) ?? {}) } : null },
    exists,
    free,
    refuse: async () => { if (await exists()) throw new Error(`${at} exists locally: the boot protocol cannot target it`) }
  }
}
