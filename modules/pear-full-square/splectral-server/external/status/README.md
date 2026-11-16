# status

Says whether Splectral's server runs, where it is served and what it follows.

## Signature

`status(exec)`: requested as `splectral/status`, at the mrepo itself.

## Returns

- Running: `{ running: true, url, pid, outbox, started }`.
- Not running: `{ running: false }`.

## Errors

The context names no directory: an mrepo that is not on disk has no
server to ask about.
