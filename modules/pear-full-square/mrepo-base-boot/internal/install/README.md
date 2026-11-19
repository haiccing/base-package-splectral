# install

Puts an mrepo in its folder from a target package's list: laid in, built, its packages placed.

The three steps a deploy is made of, in one call, for whoever makes an
mrepo: the boot protocol's deploy, and the container protocol's create.
The runtime is not started here: that is the caller's.

## Signature

`install(exec, { store, sources, target, dir, uri, laid })`

- `store`, `sources`: where the packages come from, as `origin` gives
  them.
- `target`: the package whose list the mrepo is made of, `<org>/<package>`.
- `dir`: the mrepo's folder. It must not be there.
- `uri`: the mrepo's unique URI, written into its runtime layer
  (`/runtime/mrepo.json`), where it has one.
- `laid`: optional, `(folder) => {}`: called with the structure laid in,
  before it is built, to change it.

`origin(exec)` reads the store and the sources from the mrepo's own
packages manifest: `{ store, sources, packages }`, `packages` the names
of its own, in order, the last the package that defines it.

`targetOf(name)`: a package named fully qualified, `<org>/<package>`, as
it is; a package without its organisation is refused, none is assumed.

## Returns

`{ package, packages, layers }`: the target, the packages placed, in
order, and each layer's commit.

## Errors

- The folder is there already: `in the way`.
- The mrepo's packages manifest names no store.
- What `lay`, `build` and `place` throw.
