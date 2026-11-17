# mrepo/

The package's part of the structure: the Splectral mrepo's list of packages and its runtime config.

- **Its packages** (`packages/layer.json`): the runtime, the info
  protocol, the protocol protocol, the service protocol, and this
  package last.
- **Its runtime config**: the service state and the hooks, below.
- **Nothing else**: no layer of its own, no data. `main` stays empty.

## Runtime config

- **`runtime/service.json`**: the service state, `booted`: the Splectral
  mrepo is service managed.
- **At `boot`**: `info`, `runtime` and `service` activated.
- **At `initialise`**: its info extracted.
- **At `start`**: `splectral` activated, then the server started
  (`splectral/start`): the page is there once the mrepo is started.
- **At `stop`**: the server ended (`splectral/stop`), then `splectral`
  deactivated.

The hooks of a transition run in name order: `activate-splectral`
before `serve`, `close` before `deactivate-splectral`.
