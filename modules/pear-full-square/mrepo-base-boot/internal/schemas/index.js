// schemas: a package's schemas registered in the install's registry, from
// its bundle in the store (README.md beside it).
import { readFileSync, existsSync } from 'bare-fs'
import { join } from 'bare-path'
import Bundle from 'bare-bundle'
import { registry, schemasOf } from 'mycelium-value-avro'

export { schemasOf }

// A package's schemas, as its bundle carries them: its own (/schemas/), and
// each of its modules' (/modules/<org>/<module>/schemas/). -> [{ file, schema }]
const SCHEMA = /^\/(modules\/[^/]+\/[^/]+\/)?schemas\/[^/]+\.json$/
export function carried ({ store, pkg }) {
  const bundle = Bundle.from(readFileSync(join(store, `${pkg}.bundle`)))
  return Object.keys(bundle.files).filter(k => SCHEMA.test(k)).sort().map(file => ({ file, schema: JSON.parse(bundle.read(file).toString()) }))
}

// Every package's schemas registered: the creator registers (deploy).
// -> { <org>/<package>: [{ fingerprint, uri, added }] }
export function register ({ store, packages }) {
  const reg = registry(schemasOf(store))
  const out = {}
  for (const pkg of packages) {
    // the commit that brought them: the package's, as its manifest entry says
    const known = join(store, `${pkg}.json`)
    const commit = existsSync(known) ? JSON.parse(readFileSync(known, 'utf8')).commit ?? null : null
    out[pkg] = carried({ store, pkg }).map(({ file, schema }) => {
    // catch: said with the package and the file it is in
    try { return reg.add(schema, { commit }) } catch (err) { throw new Error(`not a schema: ${pkg} ${file}: ${err.message}`, { cause: err }) }
    })
  }
  return out
}
