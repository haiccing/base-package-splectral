# schemas

Registers the schemas a package carries in the install's registry, from its bundle in the store.

A package carries its schemas sealed in its bundle: its own in
`schemas/`, each of its modules' in `modules/<org>/<module>/schemas/`
(`haiccing/base-docs-package`, "Schemas"). Deploying registers them: the
creator registers, `place` for every package it puts in place. The
registry is an index, not a gatekeeper (`mycelium-value-avro`): a schema
registered again is the same entry; a new version, a new fingerprint
beside the old.

## Signature

- `register({ store, packages })`: each package's schemas into the
  registry at `schemasOf(store)`, each with the commit that brought it
  (the package's, its manifest entry's `commit`).
- `carried({ store, pkg })`: a package's schemas, read from its bundle.
- `schemasOf(store)`: the install's registry, `<store>/schemas`.

## Returns

- `register`: `{ <org>/<package>: [{ fingerprint, uri, added }] }`.
- `carried`: `[{ file, schema }]`, the files in path order.

## Errors

A schema that is not valid AVRO: the deploy stops, naming it.
