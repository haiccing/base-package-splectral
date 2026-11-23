# mrepo-base-boot

The mrepo boot protocol: deploy, tear down and redeploy a child mrepo, executed by its parent.

Deploy builds a child from a target package's list, links its packages,
starts its runtime and waits for the child's `commission`. Teardown asks
for the child's `decommission` first, then stops the runtime and removes
the child; redeploy does both. Each is idempotent (a deploy of what is
there, a teardown of what is not: a warning). The
module also holds the install routine. Carried by
`haiccing/base-package-boot`, which offers the actions, and by
`haiccing/base-component-boot`, which builds the boot mrepo with the same
routine.

## Links

- [external](external/)
- [internal](internal/)
- [test](test/)

## Design

- **A documented method a directory**: its `index.js` and its
  `README.md`. Smaller methods live in the one they belong to, listed
  there under "Also exported"; a helper with nothing to document is a
  plain file. The module's `index.js` exports them.
- **External methods** are protocol actions, `(exec, form)`, run inside
  the execution context; the parent's directory comes from
  `exec.runtime.dir`.
- **Internal methods** are called by code: by the actions, and by the boot
  itself before any runtime runs.
- **The schemas registered at deploy**: placing a package registers the
  schemas its bundle carries, its own and its modules', in the install's
  registry, beside the packages in the store (`internal/schemas`;
  `mycelium-value-avro`): the creator registers.
- **Not yet**: the requirements resolved into packages; what an action does
  outside the repository, such as a runtime started or a folder removed, is
  not undone by a reset.

## Placement

A child is placed by its unique URI, side by side with the others under
the work folder's `mrepos/` (`mrepos/local/host`), not inside its parent.
Its unique URI is a path: in its parent's namespace (`local`), unless a
node above it says it is a namespace: a swarm, `{"kind":"swarm"}`, then
it is that swarm's node, `<swarm>/<name>` (`mrepos/swarm-1/node-1`); a
`howtos` node, `{"kind":"howtos"}`, then the path below it is its URI
(`howtos/haiccing/base-package-crud/howto/query/boot`:
`mrepos/haiccing/base-package-crud/howto/query/boot`). No unique URI is a
prefix of another's: no mrepo's folder inside another's.
The parent holds a node for it in its `main`, a shortcut: which mrepo,
and the link's key; and the link's record in its `links` layer, by that
key: what this machine knows of it (where it is, the position that
links to it, how it came about, its package, what runs it): the
managing mrepo's, in forward visibility only. The install's registry,
for its system administration, is the work folder's `mrepos/` itself:
nothing in an mrepo copies it.

## Tests

- `brittle-bare test/*.test.js` (Bare installed): the unit tests: building, running a built mrepo on the
  runtime, the actions.
