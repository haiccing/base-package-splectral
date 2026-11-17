# base-package-splectral

Splectral: an install and its commands shown in a browser as they complete, from an mrepo of its own beside the host.

Splectral is for seeing a running system. Deployed by the boot mrepo
beside the host, the Splectral mrepo runs a server once it is started.
The server follows the boot mrepo's outbox folder, where every command
of the install ends as a completed record, and serves one page: the
install as a tree, and the commands, the newest first. It reads only:
it sends no command.

## Links

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

## How to

See the commands of an install in a browser. The boot mrepo is there
(`haicc boot/deploy`).

```
haicc . boot/deploy splectral base-package-splectral --flags continuation=start
haicc splectral splectral/status
```

The deploy answers with the script `start`, which brings the mrepo into
service; its `start` starts the server. `splectral/status` says where
the page is: `http://127.0.0.1:4400`, or another port when that one was
taken. Open it in a browser on the same machine, then send commands
from a terminal and see each arrive:

```
haicc . boot/deploy host base-component-haicc --flags continuation=cluster
```

To end it:

```
haicc splectral service/stop
haicc . boot/teardown splectral
```

## Commands

```
haicc splectral splectral/status
haicc splectral splectral/stop
haicc splectral splectral/start 4401
```

- `splectral/start [<port>]`: the server started, on port 4400 when
  none is given; `0` for any free port. Running already: left as it is.
- `splectral/stop`: the server ended.
- `splectral/status`: whether it runs, its URL, the folder it follows.

The service's `start` and `stop` do the first two by their hooks; the
commands are for a server on another port, or started again.

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

In `protocol.js`, the package's: the three actions at the mrepo
itself; `start` takes a port, optional.

## Package

- `protocol.js`: the `splectral` protocol, its config and its actions,
  from `splectral-server`.
- `run.js`: the server's program, what `splectral/start` starts from the
  mrepo's own packages.
- `main.js`: the dispatcher, the bundle's main, generated.
