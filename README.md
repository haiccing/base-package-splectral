# base-package-splectral

Splectral, an app platform beside the host: the install shown in a browser, its components served.

Splectral is for seeing and working with a running system. Deployed by
the boot mrepo beside the host, it runs a server once it is started, the
data layer. The server follows the boot mrepo's outbox folder and serves
its page: the install as a tree, and its commands. Its components are
apps, each served at `/<position>/` (below, "Components").

## Links

- [start](modules/pear-full-square/splectral-server/external/start/)
- [stop](modules/pear-full-square/splectral-server/external/stop/)
- [status](modules/pear-full-square/splectral-server/external/status/)
- [install](modules/pear-full-square/splectral-server/external/install/)
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
- [base-package-boot](../base-package-boot/)
- [base-package-service](../base-package-service/)
- [base-package-haicc](../base-package-haicc/)

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

## Components

A component is an app: an mrepo Splectral deploys, in two halves.

```
haicc splectral boot/deploy help haiccing/base-package-service
haicc splectral splectral/install help splectral/base-component-help-viewer
haicc splectral/help service/initialise
haicc splectral/help service/start
```

The first half is haicc's: a plain service-managed mrepo. The second is
Splectral's: the component's packages, all of its own organisation,
placed in that mrepo's folder (`splectral/`), its Splectral inbox and
outbox beside them, its `start` and `stop` hooks laid by the mrepo
itself; its service started, its program runs. The browser asks
`/help/<path>`: the server writes the page request into the
component's Splectral inbox and answers with the page that comes back
in its outbox; what the component asks for meanwhile (`info/get` at
`docs`, say) the server runs as a terminal does. Commands for the
component as an mrepo go through haicc, as to any: `haicc
splectral/help service/stop`, `haicc splectral boot/teardown help`.

## Config

The `splectral` protocol's, in `protocol.js`: `start`, `stop` and
`status` at the mrepo itself, `.`; `install` at a position below `main`.

| action | arguments | |
|---|---|---|
| `start` | the port, optional: 4400; `0` any free one | running already: left as it is |
| `stop` | none | the server ended |
| `status` | none | whether it runs, its URL, the folder it follows |
| `install` | the component, `<org>/<package>`; at the position of an mrepo it deployed | its packages laid on top: the second half of a dual install |

The service's `start` and `stop` do the first two by their hooks; the
actions are for a server on another port, or started again.

## Package

- `protocol.js`: the `splectral` protocol, its config and its actions,
  from `splectral-server`.
- `run.js`: the server's program, what `splectral/start` starts from the
  mrepo's own packages.
- `main.js`: the dispatcher, the bundle's main, generated.
