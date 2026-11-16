# test/mounted/

The package's own test: its protocol as mounted, the mrepo it defines, its server started from its own program.

The package's `protocol.js` is what a runtime loads, its `mrepo/` what
a deploy lays in, its `run.js` what `splectral/start` starts. All three
are checked here, without an mrepo.

## What it checks

- **What it provides**: one protocol, `splectral`, with a function for
  every action configured and no other.
- **Its config, value by value**: the package that brings it; `start`,
  `stop` and `status`, each at the mrepo itself; a port for `start`,
  optional; no state.
- **The mrepo it defines**: its list of packages, itself last; its
  hooks, file by file, each with its transition and its command, and
  their order within `start` and `stop`; the state it starts in; its
  script `start`. A hook file not named in the test fails it.
- **Its actions**, on a minimal execution: nothing running; what `start`
  refuses; then its server started from the package's own `run.js` as a
  process of its own, its page and its lines asked over HTTP, its
  status, and ended.
- **Nothing forgotten**: the last test fails when the config names an
  action that was not run here, or one that wrote nothing into the
  request's log as it ran.

## Not here

The Splectral mrepo deployed and running: its hooks fired by the
service, its server started from its bundle in the mrepo's packages,
the commands of a real install on its page. That is the `haicc`
command's end to end test.
