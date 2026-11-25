# serve

Runs Splectral's server in this process: the site, a folder's records as lines, the install's structure, streamed.

## Signature

`serve({ outbox, port, host, other, keep, every })`

- `outbox`: the folder of completed records it follows.
- `root`: the unique URI of the mrepo whose outbox that is: `local/boot`
  when none.
- `port`, `host`: where it listens: 4400 on `127.0.0.1` when none.
- `other`: when the port is taken, a free one instead (the default);
  `false`: it fails.
- `keep`: how many lines it holds, the last 500 when none.
- `every`: the slow look at the folder, in milliseconds.

## Returns

`{ url, port, outbox, root, records(), structure(), clients(), close() }`:
where it is served; the lines so far, the oldest first; the structure
as it is now; the streams open now;
`close` ends it: the folder no longer followed, its streams and
connections ended.

## Errors

It cannot listen there: `not served at <host>:<port>`.

## Design

- `GET` only: the site (`site`), at `/` and `/install` with Splectral's
  own page (`page`) in it, at `/<position>/<path>` with that
  component's page `<path>`; `/records`, `/record/<key>`, `/structure`,
  `/stream`. Anything else is answered 404, another method 405.
- The stream carries a line a record, and, when a record changed the
  structure, the structure whole as an event of its own, `structure`,
  with the node that changed.
- The structure is folded from every record, also those no longer among
  the lines held.
- A record is served whole from its file, by its offset: only those of
  lines it holds, so no path is taken from a request.

## Also exported

`mreposOf(snapshot)`: the install's mrepos as a command names them,
from the structure: `{ version, mrepos: [{ at, depth, package }] }`,
each by its position from the root (`.`, `docs`, `splectral/help`), in
the tree's order; what a component asks for (`components`).
`PORT`: 4400. `HOST`: `127.0.0.1`. `ROOT`: `local/boot`.
