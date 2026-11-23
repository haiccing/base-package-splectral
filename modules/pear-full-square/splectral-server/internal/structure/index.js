// structure: the install as its completed commands made it: the mrepos, a
// tree, each with its state (README.md beside it).

// The position a swarm's node's replica is linked at: a swarm node is
// shown as one node, its container part of it.
const CONTAINER = 'container'
const isReplica = uri => uri.endsWith(`/${CONTAINER}`)

// The structure of an install, folded from its completed records.
//   root   the root mrepo's unique URI: where a record that was sent on
//          nowhere was executed
export function createStructure (root) {
  // by unique URI: { uri, parent, at, package, service, container }
  const nodes = new Map([[root, { uri: root, parent: null, at: '.', package: null, service: null, container: null }]])
  // how many times it changed: a reader's copy is stale once it moved
  let version = 0
  const below = uri => [...nodes.values()].filter(n => n.parent === uri)
  const drop = uri => { for (const n of below(uri)) drop(n.uri); nodes.delete(uri) }
  const childAt = (parent, at) => below(parent).find(n => n.at === at) ?? null

  // What one output says, executed at the mrepo `at`. -> the unique URI
  // of the node it changed, or null.
  function one (at, out) {
    if (!out || typeof out !== 'object') return null
    // a swarm node's replica: what happens in it is its node's container's
    const node = isReplica(at) ? at.slice(0, -CONTAINER.length - 1) : at
    const n = nodes.get(node)
    // deployed: a child of the mrepo that executed it, by its unique URI
    if (typeof out.deployed === 'string' && typeof out.mrepo === 'string') {
      if (!n || isReplica(at)) return null
      const was = childAt(node, out.deployed)
      if (was) drop(was.uri)
      nodes.set(out.mrepo, { uri: out.mrepo, parent: node, at: out.deployed, package: out.package ?? null, service: typeof out.service === 'string' ? out.service : null, container: null })
      return out.mrepo
    }
    // torn down: the child at that position, and what was below it
    if (typeof out.tornDown === 'string') {
      const gone = n ? childAt(node, out.tornDown) : null
      if (!gone) return null
      drop(gone.uri)
      return node
    }
    if (!n) return null
    // the service moved: the mrepo's own, or its replica's
    if (typeof out.service === 'string' && typeof out.state === 'string' && out.started !== CONTAINER) {
      if (isReplica(at)) { if (!n.container) return null; n.container.service = out.state } else n.service = out.state
      return node
    }
    // the container protocol: a replica made, started, stopped, removed, asked for
    if (out.created === CONTAINER && out.container?.name) { n.container = { name: out.container.name, state: 'created', service: null }; return node }
    if (out.removed === CONTAINER) { n.container = null; return node }
    if ((out.started === CONTAINER || out.stopped === CONTAINER || out.replica === CONTAINER) && typeof out.state === 'string') {
      n.container = { name: typeof out.container === 'string' ? out.container : n.container?.name ?? null, state: out.state, service: out.state === 'running' ? (typeof out.service === 'string' ? out.service : n.container?.service ?? null) : null }
      return node
    }
    if (out.replica === null && out.state === 'none' && n.container) { n.container = null; return node }
    return null
  }

  return {
    // A completed record taken in: what it changed, if anything. -> the
    // unique URI of the node it changed last, or null.
    apply (envelope) {
      const form = envelope?.value?.value
      if (!form || typeof form !== 'object' || Array.isArray(form) || 'error' in form || !('output' in form)) return null
      const sent = (Array.isArray(form.log) ? form.log : []).filter(e => e.event === 'request.sent' && e.mrepo).map(e => e.mrepo)
      const at = sent.length ? sent[sent.length - 1] : root
      let changed = null
      // (several torn down at once: a list of what each said)
      for (const out of Array.isArray(form.output) ? form.output : [form.output]) changed = one(at, out) ?? changed
      if (changed) version++
      return changed
    },
    // The tree as it is now: its nodes, each parent before its children,
    // the children by their position; its version, the changes so far.
    snapshot () {
      const out = []
      const walk = (uri, depth) => {
        const n = nodes.get(uri)
        out.push({ ...n, container: n.container ? { ...n.container } : null, depth })
        for (const c of below(uri).sort((a, b) => a.at.localeCompare(b.at))) walk(c.uri, depth + 1)
      }
      walk(root, 0)
      return { root, version, nodes: out }
    }
  }
}
