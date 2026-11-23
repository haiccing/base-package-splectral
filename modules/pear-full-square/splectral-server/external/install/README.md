# install

Lays a component's packages on top of an mrepo Splectral deployed: the second half of a dual install.

A Splectral component is an mrepo, made in two halves. The first is
haicc's: a plain service-managed mrepo, deployed by Splectral with the
boot protocol (`boot/deploy <position> base-package-service`). The
second is this, below ("Design"). Splectral's server then routes the
browser to it at `/<position>/`.

## Signature

`install(exec, { uri, args })`: requested as `splectral/install
<position> <component>`.

## Arguments

1. The component, `splectral/<package>`: a package whose list ends with
   itself, every package in it of the `splectral` organisation. Required.

## Returns

`{ installed, component, mrepo, packages, laid }`: the position, the
component, the mrepo's unique URI, the packages placed in order, and the
runtime config laid (`runtime/hooks/start.haicc`, ...).

## Errors

- No position, the mrepo itself: `missing argument: target`.
- A position deeper than one name, or one of the server's own paths
  (`records`, `record`, `structure`, `stream`, `index.html`): `not a
  position for a component`.
- Nothing deployed there: `not deployed: <position> (boot/deploy
  <position> haiccing/base-package-service first)`.
- Another component there already: deploy and teardown, no upgrade in
  place. The same one again is allowed (idempotent): a warning,
  `installed already`, nothing done, `again: true` in the answer.
- No component named, or not `<org>/<package>`; not of the `splectral`
  organisation: `not a Splectral component`.
- Its list: none; not ending with itself; naming another organisation's
  packages.
- What fetching it from the sources throws; its runtime config not laid.

## Design

- **What it does**: the component's own list, packages of its
  organisation, placed in that mrepo's folder on Splectral's side of it,
  their schemas registered in the install's registry as a deploy's are;
  its Splectral inbox and outbox made; its runtime config (its `start`
  and `stop` hooks, its program started and ended) laid by the mrepo
  itself (`runtime/lay`).
- **The mrepo's folder, Splectral's side of it**: `<folder>/splectral/`:
  `packages/` (the bundles and their addons, hard linked from the store,
  as a deploy places an mrepo's own), `inbox/`, `outbox/`, and
  `component.json`, what was installed (with `schemas`, the install's
  registry, where its typed records are read). Files of this machine, not
  layers: nothing of it is the mrepo's runtime's to read, but for the
  runtime config it lays itself.
- **One writer**: Splectral writes no layer of the component's. The
  component's mrepo lays its runtime config itself, asked through haicc
  (`haicc <position> runtime/lay . splectral/packages/<component>`); this
  request waits for it.
- **Splectral's record**: `<Splectral's folder>/components/<position>.json`,
  read by the server to route to it.
