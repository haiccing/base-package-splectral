// fetch: a package into the store, checked; also available, structureOf, put, parseSource (README.md beside it).
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, linkSync, copyFileSync } from 'bare-fs'
import { join, dirname } from 'bare-path'
import crypto from 'bare-crypto'
import Bundle from 'bare-bundle'

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

// A package from the sources, in order: its manifest entry and its folder.
function find (sources, pkg) {
  const [org] = pkg.split('/')
  for (const s of sources) {
    if (s.kind !== 'folder') continue
    const mf = join(s.path, org, 'manifest.json')
    if (!existsSync(mf)) continue
    const entry = JSON.parse(readFileSync(mf, 'utf8')).packages?.[pkg]
    if (entry && existsSync(join(s.path, entry.file))) return { source: s.path, entry }
  }
  return null
}

// Every package the sources offer, each once, the first source's first:
// the packages in each folder source's <org>/manifest.json, sorted.
export function available (sources) {
  const out = new Set()
  for (const s of sources) {
    if (s.kind !== 'folder' || !existsSync(s.path)) continue
    for (const org of readdirSync(s.path).sort()) {
      const mf = join(s.path, org, 'manifest.json')
      if (!existsSync(mf)) continue
      for (const pkg of Object.keys(JSON.parse(readFileSync(mf, 'utf8')).packages ?? {})) out.add(pkg)
    }
  }
  return [...out].sort()
}

export function fetch ({ store, sources, pkg }) {
  const file = join(store, `${pkg}.bundle`)
  const known = join(store, `${pkg}.json`)
  if (existsSync(file) && existsSync(known)) return JSON.parse(readFileSync(known, 'utf8'))
  const found = find(sources, pkg)
  if (!found) throw new Error(`not in the store nor the sources: ${pkg}`)
  const { entry } = found
  if (sha256(readFileSync(join(found.source, entry.file))) !== entry.sha256) throw new Error(`not as its manifest says (sha256): ${pkg}`)
  for (const a of entry.addons) {
    if (existsSync(join(store, 'addons', a))) continue
    if (sha256(readFileSync(join(found.source, 'addons', a))) !== a) throw new Error(`an addon not as named (sha256): ${a}`)
    put(join(found.source, 'addons', a), join(store, 'addons', a))
  }
  put(join(found.source, entry.file), file)
  writeFileSync(known, JSON.stringify(entry, null, 2) + '\n')
  return entry
}

export function structureOf ({ store, pkg }) {
  const bundle = Bundle.from(readFileSync(join(store, `${pkg}.bundle`)))
  const out = {}
  for (const key of Object.keys(bundle.files)) if (key.startsWith('/mrepo/')) out[key.slice('/mrepo/'.length)] = bundle.read(key)
  return out
}

// A script of a package: its lines, each a simple command, by name, in its
// bundle (/scripts/<name>.haicc); null when it has none of that name.
export function scriptOf ({ store, pkg, name }) {
  const bundle = Bundle.from(readFileSync(join(store, `${pkg}.bundle`)))
  const key = `/scripts/${name}.haicc`
  if (!(key in bundle.files)) return null
  const text = bundle.read(key).toString()
  if (!text.split('\n').some(l => l.trim() && !l.trim().startsWith('#'))) throw new Error(`not a script: ${pkg} ${name} (no command in it)`)
  return text
}
// The names of a package's scripts.
export const scriptsOf = ({ store, pkg }) => Object.keys(Bundle.from(readFileSync(join(store, `${pkg}.bundle`))).files).filter(k => /^\/scripts\/[^/]+\.haicc$/.test(k)).map(k => k.slice('/scripts/'.length, -'.haicc'.length)).sort()

// A package's scripts placed in the install's scripts folder, where the
// haicc command reads them by name: <scripts>/<org>/<package>/<name>.haicc,
// written over (idempotent). -> the names placed
export function placeScripts ({ store, pkg, into }) {
  const bundle = Bundle.from(readFileSync(join(store, `${pkg}.bundle`)))
  const names = scriptsOf({ store, pkg })
  for (const name of names) {
    const to = join(into, ...pkg.split('/'), `${name}.haicc`)
    mkdirSync(dirname(to), { recursive: true })
    writeFileSync(to, bundle.read(`/scripts/${name}.haicc`))
  }
  return names
}

export function put (from, to) {
  mkdirSync(dirname(to), { recursive: true })
  rmSync(to, { force: true })
  // catch: no hard link to be had there (another device, a filesystem without them): copied instead, and the copy says what is wrong
  try { linkSync(from, to) } catch { copyFileSync(from, to) }
}

export function parseSource (s) {
  const i = s.indexOf(':')
  const kind = i < 0 ? s : s.slice(0, i)
  const at = i < 0 ? '' : s.slice(i + 1)
  if (kind === 'folder') return { kind, path: at }
  if (kind === 'github') return { kind, org: at || 'haiccing' }
  throw new Error(`not a source: ${s} (folder:<path>, github:<org>)`)
}
