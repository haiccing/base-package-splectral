# components

Splectral's components as the server sees them, and the exchange with each over its Splectral inbox and outbox.

## Signature

- `createComponents({ dir, boot, root, mrepos, wait, timeout, every })`:
  the components `splectral/install` recorded in Splectral's folder `dir`
  (`components/<position>.json`), each one's outbox followed; `boot` the
  root mrepo's folder, its inbox the one gateway; `root` its unique URI;
  `mrepos()` the install's mrepos as the server knows them (`serve`'s
  `mreposOf`).
- `ask({ boot, root, form, timeout })`: a data request run.
- `recordOf(dir, position)`: where a component's record is.
- `typedBox(rec)`: a component's inbox for typed answers, its records
  AVRO by the install's registry (its record's `schemas`).
- `SIDE` (`splectral`), `COMPONENTS` (`components`), `TOPIC`
  (`/splectral`, where a completed form goes back).

## Returns

- `createComponents`: `{ has(position), list(), page(position, path,
  query), stop() }`; `page` answers `{ status, form }`, the form completed
  with its `output`, the page, or its `error`.
- `ask`: `{ output }` or `{ error }`; with `raw: true` in the form, also
  `record`, the response whole as its folder holds it.

## Errors

None thrown: what fails is the form's `error`. Its program not running
(no live state, `runtime/start`'s, for the first of its list): status
503, at once. A page not answered in `wait` (20 s): status 504.

## Design

- **What passes is fixed**, the same for every component, request records
  as documented (a form in an envelope, its key), written whole into a
  folder:
  - a page asked for, into the component's Splectral inbox:
    `{ request: "page", path, query }`; its completed form back in its
    Splectral outbox, `output` the page's HTML, its links relative to its
    section (the site gives the page its base: `site`);
  - data asked for, by the component, in its outbox: `{ request: "data",
    at, command }`: run as a terminal runs a command, into the root
    mrepo's inbox, tagged as from outside (`haicc <at> <command>`), its
    completed form written into the component's inbox under the same key;
    `raw: true` asks for the response whole as well (`record`), what the
    terminal reads and prints; `as: <schema URI>` asks for the answer
    typed: written back as AVRO (`internal/typed`), its output as that
    schema where it is valid as it, else `json`, when the component's
    record names the install's registry (`schemas`); without one, JSON;
  - the install's mrepos, by the component, in its outbox: `{ request:
    "mrepos" }`: answered by the server from what it knows, its
    structure, nothing run: `output` `{ version, mrepos: [{ at, depth,
    package }] }`, each mrepo by the position a command names it with
    (`.`, `docs`, `splectral/help`); `version` moves when the structure
    changes, so a component knows when what it keeps is stale;
  - an mrepo by its unique URI, by the component, in its outbox: `{
    request: "mrepo", uri }`: resolved at the root from the install's
    registry (`haicc . haicc/mrepos <uri>`): `output` `{ uri, position
    }`, its position from the root through the links, what a data
    request's `at` is (`local/docs` at `workbench/docs`); kept while the
    structure is the same. Not in the registry, or not reachable from the
    root: an error.
- **The boxes are queues**: a record taken is removed, by whoever reads
  that box. What a component keeps comes later, with commit times.
- **A watcher at each end**: the server follows each component's outbox
  (watched, and looked at every `every`), the component's program its
  inbox.
