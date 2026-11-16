# serve

Runs Splectral's server in this process: the page, the records of a folder as lines, each new one streamed.

## Signature

`serve({ outbox, port, host, other, keep, every })`

- `outbox`: the folder of completed records it follows.
- `port`, `host`: where it listens: 4400 on `127.0.0.1` when none.
- `other`: when the port is taken, a free one instead (the default);
  `false`: it fails.
- `keep`: how many lines it holds, the last 500 when none.
- `every`: the slow look at the folder, in milliseconds.

## Returns

`{ url, port, outbox, records(), clients(), close() }`: where it is
served; the lines so far, the oldest first; the streams open now;
`close` ends it: the folder no longer followed, its streams and
connections ended.

## Errors

It cannot listen there: `not served at <host>:<port>`.

## Design

- `GET` only: `/`, `/records`, `/record/<key>`, `/stream`. Anything
  else is answered 404, another method 405.
- A record is served whole from its file, by its key: only keys of
  lines it holds, so no path is taken from a request.

## Also exported

`PORT`: 4400. `HOST`: `127.0.0.1`.
