# pair

A child deployed into a Docker container, run there by the container's own haicc install: the pair deploy.

The container's platform, its boot mrepo, executes the platform commands
on the child (its deploy, its teardown) and its `mrepos/` has it; this
mrepo links it and forwards to it as to any
linked mrepo, through its inbox and outbox folders. The container's haicc
home is a folder of this host's, `<work>/containers/<unique URI>/`,
mounted into it: this host uses only the inboxes and outboxes in it.

## Signature

- `pairOf(exec, c)`: a child's pair (`c`: the boot actions' child): its
  folder, the folders of the container's boot mrepo and of the child in
  it, each relative to this mrepo's folder too, its container's name.
- `deployPair(exec, c, { target, sources })`: the pair made, the child
  deployed in it by the container's platform. `{ container, folder,
  platform, pair, packages }`. Throws, nothing left, when the container is
  not made, does not boot in time, or its platform refuses.
- `teardownPair(exec, c, recorded)`: the child torn down by the
  container's platform (when the container runs), the container and its
  folder removed. `{ container, platform }`.

## Also exported

`PAIRS` (`containers`, under the work folder), `IMAGE`
(`debian:bookworm-slim`), `HOME` (`/haicc`, the container's haicc home
inside it).

## Not yet

- **The node brought back on a restart**: started again, the container
  boots its install again; whether its boot starts the node's runtime
  again is to be checked.
- **The shared folder narrowed**: today the container's whole haicc home
  is shared (a prototype's simplest); settled for later, only the
  container's boot mrepo and the node shared, every mrepo the node
  deploys in the container only.
- **Replication** of a node's commits, for a node on another machine, where
  no folder is shared: one Hypercore per direction.
