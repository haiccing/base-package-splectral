# process

Splectral's server as its own process: the program, started, its state read, ended.

## Signature

- `program(argv)`: the server run in this process until it is ended.
  `--dir=<the mrepo's folder>`, `--outbox=<the folder to follow>`,
  `--root=<unique URI>`, `--port=<n>`, `--runtime=<pid>`.
- `launch({ program, dir, outbox, root, port, runtime, bare, wait })`: the
  program started as its own process. `program` is what Bare is started
  with: the package's bundle, or this module's `cli.js`.
- `stateOf(dir)`: the state of the server of the mrepo at `dir`.
- `end(dir, { wait })`: that server ended.

## Returns

- `program`: resolves when the server has closed.
- `launch`: the server's state once it listens; `null` when it did not
  come up within `wait` (ten seconds).
- `stateOf`: `{ pid, url, port, outbox, root, started }`; `null` when none
  runs: no state, or one left by a process that is gone.
- `end`: `{ pid, how }`, `how` being `SIGTERM` or `SIGKILL`; `null`
  when none was running.

## Errors

- `program`: no `--dir` or no `--outbox`; the server cannot listen.
- `end`: the process did not end.

## Design

- The state is a file in the mrepo's own folder, `splectral.json`,
  written when the server listens and removed when it closes: beside
  the runtime's socket, not in a layer. It is this machine's.
- The program ends on SIGTERM and SIGINT, when the mrepo's folder is
  gone, and when the runtime it was given has ended: looked at four
  times a second.
- It is started through the shell, in its own session: it outlives the
  request that started it.

## Also exported

`STATE`: `splectral.json`.
