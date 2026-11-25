// install: an mrepo put in its folder from a target package's list; also
// origin, targetOf (README.md beside it).
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'bare-fs'
import { join, dirname } from 'bare-path'
import { tmpdir } from 'bare-os'
import { build } from '../build/index.js'
import { parseSource } from '../fetch/index.js'
import { lay } from '../lay/index.js'
import { place } from '../place/index.js'

// A package is named fully qualified, <org>/<package>, always: no
// organisation is assumed (base-docs-haicc, "Platforms").
const QUALIFIED = /^[a-z][a-z0-9-]*\/[a-z0-9][a-z0-9.-]*$/
export const targetOf = name => {
  if (!QUALIFIED.test(String(name))) throw new Error(`not fully qualified: ${name} (<org>/<package>)`)
  return name
}

// Where this mrepo's packages come from: the store and the sources its
// packages manifest records.
// log: none (one read; install says what was laid, built and placed)
export async function origin (exec) {
  const manifest = await exec.find('/packages/manifest.json')
  let mine = null
  if (manifest !== null) { try { mine = JSON.parse(manifest.toString()) } catch (err) { throw new Error('not a document: /packages/manifest.json', { cause: err }) } }
  if (!mine?.store) throw new Error('no store: the mrepo\'s packages manifest names none')
  return { store: mine.store, sources: (mine.sources || []).map(parseSource), packages: Object.keys(mine.packages || {}) }
}

// (laid: what the caller changes in the structure laid in, before it is built)
export async function install (exec, { store, sources, target, dir, uri, laid = null }) {
  if (existsSync(dir)) throw new Error(`in the way: ${dir}`)
  // The target's list laid in: each package's mrepo/ part, in that order,
  // runtime config from the last only; built at its own place.
  const tmp = mkdtempSync(join(tmpdir(), 'install-'))
  try {
    const { list } = await exec.step('lay', r => ({ package: target, packages: r.list.length }), async () => lay({ store, sources, target, into: tmp }))
    // Its identity, in its runtime layer (where it has one): its unique URI.
    if (existsSync(join(tmp, 'runtime', '.layer.json'))) writeFileSync(join(tmp, 'runtime', 'mrepo.json'), JSON.stringify({ uri }, null, 2) + '\n')
    if (laid) laid(tmp)
    mkdirSync(dirname(dir), { recursive: true })
    const { layers } = await exec.step('build', r => ({ dir, layers: Object.keys(r.layers).length }), () => build({ from: tmp, dir, setting: false }))
    const { packages } = await exec.step('place', r => ({ packages: Object.keys(r.packages).length }), () => place({ dir, store, sources, list }))
    return { package: target, packages: Object.keys(packages), layers }
  } finally { rmSync(tmp, { recursive: true, force: true }) }
}
