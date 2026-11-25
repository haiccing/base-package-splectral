# deploy

Builds a child mrepo inside its parent from a target package, links its packages and starts its runtime.

The target package's `mrepo/packages/.layer.json` lists the packages the
child is made of, in order. Each is fetched into the work folder's store,
which the parent's packages manifest names. Their `mrepo/` parts are laid
in, in that order, and the child is built at its place in the work
folder, `<work>/mrepos/<unique URI>`.

## The sequence

1. **Checked**: its position, its unique URI (never a prefix of
   another's), its place free.
2. **Linked first**: its node, its shortcut and its link's record
   written in this mrepo and committed: from then on the child is known
   here, while it is built.
3. **Built at its place**, `<work>/mrepos/<unique URI>`: its packages
   placed; each package's scripts placed in the work folder's
   `scripts/`, `<work>/scripts/<org>/<package>/<name>.haicc`, where the
   haicc command reads them (`haicc/file`, `haicc scripts`).
4. **Its runtime started**: its boot hook, then its commission, waited
   for.
5. **Its link's record completed**: its runtime's process, its
   commission, its service's state.

A step that fails undoes what was done: nothing of the child left, its
link out again.

**Idempotent**: a position deployed already from the same package (or
no package given) is allowed: a warning in its log, `deployed already`,
nothing done, its record as the answer with `again: true`. From another
package: refused (`boot/redeploy` changes it).

## Signature

`deploy(exec, { uri, args })`: requested as `boot/deploy <name>
<package>`. `uri` is the child's position as the form holds it,
`["main", "<position>"]`: any position below `main`, `host` or
`swarms/swarm-1/node-1`; the node above it there already (`crud/create`).

## Arguments

1. The target package, `<org>/<package>`. Required, fully qualified: a
   package without its organisation is refused.

## Returns

`{ deployed, mrepo, package, packages, layers, scripts, runtime: { pid }, commission, service }` (`scripts`: those placed, `<org>/<package>/<name>`, when any);
`deployed` is the position as written at `main`; `mrepo` is the child's unique URI.

**Its commission**: the child's runtime, as it starts, runs its
`commission` hook (`runtime/hooks/commission.haicc`, its package's), and
the deploy waits for it: what the package does once it is deployed, its
components deployed (each deploy commissioning that one, the cascade),
its service initialised and started, as the package says. The deploy
answers when it is done, `commission: "done"` (`"none"`: no hook),
and the state its service is left in, `service` (`"started"`; `null`:
none). A
line that fails fails the deploy, the line said: nothing of the child is
left (what it deployed so far decommissioned, its runtime stopped, its
folder removed). The deploy names no service: the package decides. The
wait is bounded (30 minutes): a solution's commission deploys a whole
install.

**Into a container** (the request's flag `container`, a routing
directive): the child is deployed on another haicc install, the
container's, and run there (`internal/pair`). The container is made from
a plain image (`debian:bookworm-slim`); its haicc home is a folder of
this host's, `<work>/containers/<unique URI>/`, mounted into it: this
host's install copied in, its sources mounted read only at their own
paths. It boots itself; the child is then deployed by the container's
platform, its boot mrepo, at the same position and by the same unique
URI. Here only its link: its node, its shortcut and its record, `how:
container`, its `folder` the child's in the container's home: commands
for it are forwarded as to any linked mrepo, through its inbox and
outbox folders. Answers `{ deployed, mrepo, package, container: { name,
image } }`.

What it writes in the parent, first (step 2):

- `main/<name>/.node.json`: the child's node, an empty document.
- `main/<name>/.shortcuts.json`: its shortcut, `[{ "mrepo", "link" }]`:
  which mrepo, and the link's own key: what is needed to show it, since
  `main` replicates.
- `links/<key>.json`: the link's record in the links layer, by that
  key: what is local to this machine about it: its URI, the position
  that links to it (`at`), how it came about (`deployed`), where it is
  (`folder`, from this mrepo's own folder), the package it was deployed
  from, the packages placed, its layers, the scripts placed, its
  runtime's process, its commission, its service's state (completed in
  step 5).

The link is the managing mrepo's, in forward visibility only. The
install's registry, for its system administration, is the work
folder's `mrepos/` itself: nothing in an mrepo copies it.

Where the child is built: by its unique URI under the work folder's
`mrepos/`, `<work>/mrepos/<unique URI>`, side by side with the others;
nothing of it inside this mrepo's folder.

## Errors

- No target, `main` itself or the root: `missing argument: target`. One
  cannot deploy the mrepo itself.
- A URI that is not in `main`: `not a position in main`.
- A name that is not lowercase letters, digits and hyphens: `not a
  position for an mrepo`. A swarm's node named `local`: `not a swarm`;
  a how-to's path that starts with `local`, or is one name only: `not a
  unique URI`.
- Its unique URI a prefix of another's, or another's a prefix of its
  own (an mrepo's folder above it in `mrepos/`, or one below its place):
  `a unique URI is never a prefix of another's`. Nothing is built.
- The node above it not there: `no node there: <above> (crud/create
  <above>)`.
- A position below a shortcut: `<above> is a shortcut: a URI does not
  run through it`.
- No package: `missing argument: package`.
- The child is deployed already from another package: `deployed
  already: <position>, from <package>`. Its folder in the way: `in the
  way`.
- The position exists locally, as data in `main`: the boot protocol
  cannot target it.
- The parent's packages manifest names no store.
- The target lists no packages; its runtime does not start.
- Its commission fails: `its commission failed: line <n>: ...`, nothing of
  it left.
- Into a container: no haicc install beside the work folder; the
  container not made, or not booted in time; the container's platform
  refusing the deploy (`in the container: ...`). Nothing of it is left.

## Design

- A documentation package, marked `docs` in its manifest entry, brings no
  structure.
  READMEs are never laid in.
- The packages are linked individually into the child's `packages/`.
- The child has no presence in the parent's `main`: its shortcut is all
  the parent holds of it.
- The child's unique URI is a path, from the nearest node above it
  whose document says it is a namespace down to it. A swarm,
  `{"kind":"swarm"}`, names its namespace by its own name
  (`swarms/swarm-1`, a swarm: `swarms/swarm-1/node-1` is
  `swarm-1/node-1`); a `howtos` node, `{"kind":"howtos"}`, is the root
  of one, the path below it the URI (`howtos`, one:
  `howtos/haiccing/base-package-crud/howto/query/boot` is
  `haiccing/base-package-crud/howto/query/boot`, a how-to's unique key
  and its mrepo's name). In the namespace of the mrepo that deploys it,
  when that is not `local` (a how-to's host deploying a swarm: its
  nodes in the how-to's namespace). None above it: in its parent's
  namespace: what the boot mrepo deploys is `local/<name>`, what a
  how-to's boot deploys beside it. A position's meaning is its
  documents', not the protocol's. It is written into the child's own
  runtime layer, `/runtime/mrepo.json`, where it has one.
- **The rule**: a unique URI is never a prefix of another's, as
  `swarm-1` is a prefix and no mrepo: no mrepo's folder inside
  another's, enforced at deploy.
- The runtime is started from the child's own packages, by its directory.
