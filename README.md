# base-package-splectral

Splectral: an install and its commands shown in a browser as they complete, from an mrepo of its own beside the host.

Splectral is for seeing a running system. Deployed by the boot mrepo
beside the host, the Splectral mrepo runs a server once it is started.
The server follows the boot mrepo's outbox folder, where every command
of the install ends as a completed record, and serves one page: the
install as a tree, and the commands, the newest first. It reads only:
it sends no command.

## Links

- [start](modules/pear-full-square/splectral-server/external/start/)
- [stop](modules/pear-full-square/splectral-server/external/stop/)
- [status](modules/pear-full-square/splectral-server/external/status/)
- [howto](howto/)
- [mrepo](mrepo/)
- [scripts](scripts/)
- [test](test/)
- [test-reports](test-reports/)
- [modules](modules/)

## Included packages

- [base-package-runtime](../base-package-runtime/)
- [base-package-info](../base-package-info/)
- [base-package-protocol](../base-package-protocol/)
- [base-package-service](../base-package-service/)

## What it shows

The install: the mrepos as a tree, each with its service state; a
swarm's nodes under their swarm, a swarm node as one node with its
container's state. It is what the commands made: folded from their
records, not asked of the mrepos, so a runtime or a container that
ended without a command is not seen.

The commands: a line each, with when it completed, the mrepos it was
sent on to, its result and how long it took; a line opened shows its
record whole, its log in it.

Every command that comes in through the boot mrepo: what a terminal
sends, on this machine. A command the mrepos send among themselves (a
hook) is in the log of the command that caused it, not a line of its
own.

## Config

The `splectral` protocol's, in `protocol.js`: every action at the mrepo
itself, `.`.

| action | arguments | |
|---|---|---|
| `start` | the port, optional: 4400; `0` any free one | running already: left as it is |
| `stop` | none | the server ended |
| `status` | none | whether it runs, its URL, the folder it follows |

The service's `start` and `stop` do the first two by their hooks; the
actions are for a server on another port, or started again.

## Package

- `protocol.js`: the `splectral` protocol, its config and its actions,
  from `splectral-server`.
- `run.js`: the server's program, what `splectral/start` starts from the
  mrepo's own packages.
- `main.js`: the dispatcher, the bundle's main, generated.
