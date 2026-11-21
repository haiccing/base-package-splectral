# place

Puts an mrepo's packages in place and commits their list into its packages layer.

Each listed package is fetched into the store, then hard linked into
`<dir>/packages/`, the bundle and each addon individually: the mrepo runs
only what is registered for it. The schemas each package carries are
registered in the install's registry (`internal/schemas`).

## Signature

`place({ dir, store, sources, list, documented })`: `sources` as
`parseSource` returns them; `list` the packages, `<org>/<package>`;
`documented` those documented only (default none): each its bundle, no
addon, marked `documented` with no entry: nothing of it runs.

## Returns

`{ packages: { <org>/<package>: { sha256, id, entries, addons, documented? } }, committed }`.
`committed` is false when the manifest is unchanged; `schemas` each
package's registered schemas, `{ <org>/<package>: [{ fingerprint, uri, added }] }`.

## Errors

Those of `fetch`; a schema a package carries that is not valid AVRO.

## Also exported

- `storeOf(work)`: the work folder's package store, `<work>/packages`.
