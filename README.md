# base-package-splectral

Splectral: the commands of an install shown in a browser as they complete, from an mrepo of its own beside the host.

Splectral is for seeing a running system. Deployed by the boot mrepo
beside the host, the Splectral mrepo runs a server once it is started.
The server follows the boot mrepo's outbox folder, where every command
of the install ends as a completed record, and serves one page: the
commands, the newest first; a line opened shows its record whole. It
reads only: it sends no command.

| | |
|---|---|
| [mrepo/](mrepo/) | its part of the structure: the Splectral mrepo's list and runtime config |
| [scripts/](scripts/) | its scripts: what to go on with after a deploy |
| [test/](test/) | its tests: its protocol as mounted, its list and hooks, and the generic ones |
| [test-reports/](test-reports/) | the report of its last pre-release |
| [modules/](modules/) | its code, assembled: ours and the third-party code |

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

Every command that comes in through the boot mrepo: what a terminal
sends, on this machine. A command the mrepos send among themselves (a
hook) is in the log of the command that caused it, not a line of its
own.

## Package

- `protocol.js`: the `splectral` protocol, its config and its actions,
  from `splectral-server`.
- `run.js`: the server's program, what `splectral/start` starts from the
  mrepo's own packages.
- `main.js`: the dispatcher, the bundle's main, generated.

Written from [splectrum/splectrum-dev-env-3-mycelium](https://github.com/splectrum/splectrum-dev-env-3-mycelium).
