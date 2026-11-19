// install: splectral/install <position> <component>, a component's
// packages laid on top of an mrepo deployed at a position of Splectral's
// (README.md beside it).
import { existsSync, mkdirSync, writeFileSync, renameSync, readFileSync } from 'bare-fs'
import { join } from 'bare-path'
import { segmented, joined, within } from 'mycelium-uri'
import { shortcutsAt, linked, MAIN } from 'mrepo-base-xpath'
import { origin, fetch, structureOf, put } from 'mrepo-base-boot'
import { runLines, words } from 'mrepo-base-request'
import { RESERVED } from '../../internal/serve/index.js'
import { SIDE, COMPONENTS, recordOf } from '../../internal/components/index.js'

const NAME = /^[a-z][a-z0-9-]*$/
// Splectral's components: packages of its own family's organisation.
export const ORG = 'splectral'

export async function install (exec, { uri, args: [component] = [] }) {
  const dir = exec.runtime.dir
  if (!dir) throw new Error('no directory in the context')
  const at = within(MAIN, joined(segmented(uri ?? [])))
  if (!at || at === '.' || at === MAIN) throw new Error('missing argument: target')
  if (!NAME.test(at)) throw new Error(`not a position for a component: ${at} (one name at the top of main; deeper: not yet)`)
  if (RESERVED.includes(at)) throw new Error(`not a position for a component: ${at} (the server's own: ${RESERVED.join(', ')})`)
  exec.log('debug', 'position', { at, component: component ?? null })
  // The mrepo there: deployed by this one (boot/deploy), linked.
  const link = (await shortcutsAt(exec, at))[0]
  const local = link ? await linked(exec, link.link) : null
  if (!local?.folder) throw new Error(`not deployed: ${at} (boot/deploy ${at} haiccing/base-package-service first)`)
  const folder = join(dir, local.folder)
  if (!existsSync(folder)) throw new Error(`its folder is not there: ${folder}`)
  const side = join(folder, SIDE)
  // The second half, resumed: the runtime config laid by the mrepo
  // itself; the component recorded for the server, which routes to it.
  const resumed = exec.resumed ?? null
  if (resumed) {
    if (resumed.error) throw new Error(`its runtime config not laid: ${resumed.error}`)
    return finish(exec, dir, at, resumed, JSON.parse(readFileSync(join(side, 'component.json'), 'utf8')))
  }
  if (component === undefined || component === '') throw new Error('missing argument: package')
  if (existsSync(join(side, 'component.json'))) throw new Error(`a component there already: ${at} (deploy and teardown, no upgrade in place)`)
  // The component's list, from the sources this mrepo deploys from: all
  // of it of the component's own organisation (a list names none of
  // another's), placed in the mrepo's folder, Splectral's side of it.
  const { store, sources } = await origin(exec)
  const [org] = component.includes('/') ? component.split('/') : [null]
  if (!org) throw new Error(`not a package of an organisation: ${component} (<org>/<package>)`)
  if (org !== ORG) throw new Error(`not a Splectral component: ${component} (a package of the ${ORG} organisation)`)
  fetch({ store, sources, pkg: component })
  const listed = structureOf({ store, pkg: component })['packages/layer.json']
  if (!listed) throw new Error(`${component} lists no packages (mrepo/packages/layer.json)`)
  const list = JSON.parse(listed.toString()).packages ?? []
  if (list.at(-1) !== component) throw new Error(`${component}: its list does not end with itself`)
  const foreign = list.filter(p => p.split('/')[0] !== org)
  if (foreign.length) throw new Error(`${component}: its list names another organisation's packages: ${foreign.join(', ')}`)
  const packages = {}
  await exec.step('place', r => ({ component, packages: Object.keys(r).length }), async () => {
    for (const pkg of list) {
      const entry = fetch({ store, sources, pkg })
      put(join(store, `${pkg}.bundle`), join(side, 'packages', `${pkg}.bundle`))
      for (const a of entry.addons) put(join(store, 'addons', a), join(side, 'packages', 'addons', a))
      packages[pkg] = { sha256: entry.sha256, entries: entry.entries ?? [] }
    }
    return packages
  })
  mkdirSync(join(side, 'inbox'), { recursive: true })
  mkdirSync(join(side, 'outbox'), { recursive: true })
  const record = { at, mrepo: link.mrepo, folder, component, list, packages, installed: new Date().toISOString() }
  writeWhole(join(side, 'component.json'), record)
  // The component's runtime config (its start and stop hooks) laid by the
  // mrepo itself: its runtime is the one writer of its layers. This
  // request waits for it (resumed then, above).
  const path = `${SIDE}/packages/${component}`
  exec.log('verbose', 'placed', { at, component, packages: list.length })
  return exec.wait(() => runLines({ dir, uri: exec.runtime.uri, submit: exec.runtime.submit, answer: exec.runtime.answer }, [{ n: 1, line: `runtime/lay . ${path}`, words: words(`runtime/lay . ${path}`) }], at))
}

function finish (exec, dir, at, resumed, record) {
  const laid = resumed.output?.[0]?.output?.laid ?? []
  const r = record
  mkdirSync(join(dir, COMPONENTS), { recursive: true })
  writeWhole(recordOf(dir, at), r)
  exec.log('info', 'installed', { at, component: r.component, laid })
  return { installed: at, component: r.component, mrepo: r.mrepo, packages: r.list, laid }
}

// written aside, then renamed: never read half written
function writeWhole (file, value) {
  writeFileSync(`${file}.new`, JSON.stringify(value, null, 2) + '\n')
  renameSync(`${file}.new`, file)
}
