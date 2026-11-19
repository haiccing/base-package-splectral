# start

Starts Splectral's server: the page served, the root mrepo's outbox folder followed.

The server is its own process, started from the package's bundle in the
mrepo's `packages/`. It follows the outbox folder of the install's root
mrepo, the one the work folder's setting names: every command of the
install ends there as a completed record. It is told that mrepo's
unique URI: the root of the structure it shows.

## Signature

`start(exec, { args })`: requested as `splectral/start . [<port>]`, at
the mrepo itself: `.` its target, as every action's first argument.

## Arguments

1. The port, optional: 4400 when none. `0`: any free port. A port that
   is taken: a free one instead.

## Returns

`{ splectral: "started", url, pid, outbox }`: where the page is
(`http://127.0.0.1:4400`), the server's process, the folder it follows.
A server that runs already is left as it is and answered the same.

## Errors

- Not a port.
- The context names no work folder, or the root mrepo has no outbox
  folder: nothing to follow.
- `haiccing/base-package-splectral` is not among the mrepo's packages:
  no server to start.
- The server did not come up within ten seconds.

## Design

- The server is given the runtime's process: it ends when the runtime
  does, so a teardown leaves no server.
