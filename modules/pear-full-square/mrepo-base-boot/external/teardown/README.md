# teardown

Stops a child mrepo's runtime and removes the child, its node, its shortcut and its link's record.

The runtime is asked to stop over its socket; still running, it gets
SIGTERM, then SIGKILL, each waited for until the process has ended. How
it stopped is logged.

A child deployed into a container (its link's record `how: container`)
is not stopped here: the container's platform tears it down (a
`boot/teardown` dropped into its boot mrepo's inbox, when the container
runs), then its container and its folder are removed (`internal/pair`).
It answers `{ tornDown, container }`.

## Signature

`teardown(exec, { uri })`: requested as `boot/teardown <position>`.
The position is one of two forms:

- A child's position below `main`, as it was deployed: `uri` is
  `["main", "<position>"]`.
- `registry/<swarm>/<name>`, a query into the mrepo registry: below.

Several at once: a URI into the mrepo registry (the boot mrepo's, in
its `main`) selects mrepos there by unique URI, and each is torn down
at the position that links to it:

```
haicc . boot/teardown "registry/local/*"
haicc . boot/teardown "registry/local/*[package='haiccing/base-package-runtime']"
```

## Returns

`{ tornDown }`: the position as written at `main`. With a URI
into the registry: a list of them, empty when nothing is selected.

## Errors

- No target, `main` itself or the root: `missing argument: target`.
- The child is not deployed; or the position exists locally, which the
  boot protocol cannot target.
- Its runtime does not stop.

## Design

The folder's removal is outside the repository: a reset does not undo it.
