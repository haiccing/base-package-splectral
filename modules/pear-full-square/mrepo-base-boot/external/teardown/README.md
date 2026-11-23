# teardown

Stops a child mrepo's runtime and removes the child, its node, its shortcut and its link's record.

Its `decommission` first: its runtime asked to run its package's
`decommission` hook, waited for (what it deployed torn down, the
cascade). A line that fails stops the teardown, nothing removed. Then
the runtime is asked to stop over its socket; still running, it gets
SIGTERM, then SIGKILL, each waited for until the process has ended.

## A pair

A child deployed into a container (its link's record `how: container`)
is not stopped here: the container's platform tears it down (a
`boot/teardown` dropped into its boot mrepo's inbox, when the container
runs, its decommission there), then its container and its folder are
removed (`internal/pair`). It answers `{ tornDown, container }`.

## Signature

`teardown(exec, { uri })`: requested as `boot/teardown <position>`:
`uri` is the child's position below `main`, as it was deployed,
`["main", "<position>"]`.

## Returns

`{ tornDown }`: the position as written at `main`.

**Idempotent**: a position with nothing deployed at it (torn down
already) is allowed: a warning in its log, `not deployed`, nothing done,
`{ tornDown, again: true }`. A teardown run again, a decommission run
again, are then safe.

The scripts a deploy placed in the work folder's `scripts/` stay: they
are the install's, one copy a package, whatever deployed it.

## Errors

- No target, `main` itself or the root: `missing argument: target`.
- The position exists locally, as data in `main`: the boot protocol
  cannot target it.
- Its decommission fails: `not torn down: <position>: its decommission:
  line <n>: ...`, nothing removed.
- Its runtime does not stop.

## Design

The folder's removal is outside the repository: a reset does not undo it.
