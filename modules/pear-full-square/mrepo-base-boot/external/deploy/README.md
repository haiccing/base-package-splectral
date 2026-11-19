# deploy

Builds a child mrepo inside its parent from a target package, links its packages and starts its runtime.

The target package's `mrepo/packages/layer.json` lists the packages the
child is made of, in order. Each is fetched into the work folder's store,
which the parent's packages manifest names. Their `mrepo/` parts are laid
in, in that order, and the child is built at `<parent>/main/<name>/`.

## Signature

`deploy(exec, { uri, args })`: requested as `boot/deploy <name>
<package>`. `uri` is the child's position as the form holds it,
`["main", "<position>"]`: any position below `main`, `host` or
`swarms/swarm-1/node-1`; the node above it there already (`crud/create`).

## Arguments

1. The target package, `<org>/<package>`. Required, fully qualified: a
   package without its organisation is refused.

## Returns

`{ deployed, mrepo, package, packages, layers, runtime: { pid } }`;
`deployed` is the position as written at `main`; `mrepo` is the child's unique URI.

Asked for a script of the package (the request's flag,
`continuation=<script>`), it answers with it as its continuation: the
script's lines, read from the package's bundle (`scripts/<script>.haicc`),
for the deployed mrepo's position: the terminal sends them on as
`haicc/script <position>`. A script the package has not is refused before
anything is built, with those it has.

**Into a container** (the request's flag `container`, a routing
directive): the child is deployed on another haicc install, the
container's, and run there (`internal/pair`). The container is made from
a plain image (`debian:bookworm-slim`); its haicc home is a folder of
this host's, `<work>/containers/<swarm>/<name>/`, mounted into it: this
host's install copied in, its sources mounted read only at their own
paths. It boots itself; the child is then deployed by the container's
platform, its boot mrepo, at the same position and by the same unique
URI. Here only its link: its node, its shortcut and its record, `how:
container`, its `folder` the child's in the container's home: commands
for it are forwarded as to any linked mrepo, through its inbox and
outbox folders. Answers `{ deployed, mrepo, package, container: { name,
image } }`.

What it writes in the parent:

- `main/<name>/.node.json`: the child's node, an empty document.
- `main/<name>/.shortcuts.json`: its shortcut, `[{ "mrepo", "link" }]`:
  which mrepo, and the link's own key: what is needed to show it, since
  `main` replicates.
- `links/<key>.json`: the link's record in the links layer, by that
  key: what is local to this machine about it: its URI, the position
  that links to it (`at`), how it came about (`deployed`), where it is
  (`folder`, from this mrepo's own folder), the package it was deployed
  from, the packages placed, its layers, its runtime's process.
- `main/registry/<swarm>/<name>/.node.json`: the same record as a node
  of the mrepo registry, by its unique URI; only where `main` has the
  node `registry`: the boot mrepo.

Where the child is built: by its unique URI under the work folder's
`mrepos/`, `<work>/mrepos/<swarm>/<name>`, side by side with the others;
nothing of it inside this mrepo's folder.

## Errors

- No target, `main` itself or the root: `missing argument: target`. One
  cannot deploy the mrepo itself.
- A URI that is not in `main`: `not a position in main`.
- A name that is not lowercase letters, digits and hyphens: `not a
  position for an mrepo`. A swarm's node named `local`: `not a swarm`.
- The node above it not there: `no node there: <above> (crud/create
  <above>)`.
- A position below a shortcut: `<above> is a shortcut: a URI does not
  run through it`.
- No package: `missing argument: package`.
- The child is deployed already, or its folder is in the way.
- The position exists locally, as data in `main`: the boot protocol
  cannot target it.
- The parent's packages manifest names no store.
- The target lists no packages; its runtime does not start.
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
- The child's unique URI is `<swarm>/<name>`: in the swarm of the
  nearest node above it whose document says it is one,
  `{"kind":"swarm"}`, by that node's name (`swarms/swarm-1`, a swarm:
  `swarms/swarm-1/node-1` is `swarm-1/node-1`); none, in its parent's
  swarm: what the boot mrepo deploys is `local/<name>`. A position's
  meaning is its documents', not the protocol's. It is written into the
  child's own runtime layer, `/runtime/mrepo.json`, where it has one.
- The runtime is started from the child's own packages, by its directory.
