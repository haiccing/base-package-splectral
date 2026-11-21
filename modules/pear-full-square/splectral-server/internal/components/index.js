// components: Splectral's components as the server sees them, and the
// exchange with each over its Splectral inbox and outbox (README.md
// beside it).
import fs, { existsSync, readdirSync, readFileSync, mkdirSync, rmSync } from 'bare-fs'
import { join } from 'bare-path'
import { record, wrap, guid, inboxOf } from 'mrepo-base-request'
import { programState } from 'mrepo-base-runtime'
import { follow } from '../records/index.js'

// A component's Splectral side, in its mrepo's folder: its packages, its
// inbox and outbox, what was installed (component.json).
export const SIDE = 'splectral'
// Where Splectral records its components, in its own folder: a file each.
export const COMPONENTS = 'components'
export const recordOf = (dir, at) => join(dir, COMPONENTS, `${at}.json`)
// Where a completed form goes back: the topic of Splectral's requests.
export const TOPIC = '/splectral'

const completed = form => form && typeof form === 'object' && ('output' in form || 'error' in form)

// dir: Splectral's own folder; boot: the root mrepo's folder (its inbox
// the one gateway), root its unique URI; mrepos: the install's mrepos as
// the server knows them, { version, mrepos }.
export function createComponents ({ dir, boot, root, mrepos = () => ({ version: 0, mrepos: [] }), wait = 20000, timeout = 120, every = 2000 }) {
  const known = new Map()
  const pending = new Map()
  const folder = join(dir, COMPONENTS)
  mkdirSync(folder, { recursive: true })
  // A component's record read; its outbox followed: a page answered, a
  // data request run, the install's mrepos said. Each record taken is
  // removed: the boxes are queues.
  const back = (rec, key, form) => inboxOf(join(rec.folder, SIDE)).write(key, wrap(`/${rec.mrepo}/${SIDE}/inbox`, { ...record(TOPIC, form, key) }))
  const take = (at, rec) => (envelope, file) => {
    const form = envelope?.value?.value
    const out = join(rec.folder, SIDE, 'outbox', file)
    if (form?.request === 'page' && completed(form)) {
      rmSync(out, { force: true })
      pending.get(envelope.key)?.(form)
      return
    }
    if (form?.request === 'data' && !completed(form)) {
      rmSync(out, { force: true })
      ask({ boot, root, form, timeout }).then(answer => back(rec, envelope.key, { ...form, ...answer }))
      return
    }
    if (form?.request === 'mrepos' && !completed(form)) {
      rmSync(out, { force: true })
      back(rec, envelope.key, { ...form, output: mrepos() })
    }
  }
  const load = () => {
    if (!existsSync(folder)) return
    for (const name of readdirSync(folder)) {
      if (!name.endsWith('.json')) continue
      const at = name.slice(0, -'.json'.length)
      let rec = null
      // catch: not whole yet: read again the next time
      try { rec = JSON.parse(readFileSync(join(folder, name), 'utf8')) } catch { continue }
      if (known.get(at)?.rec.installed === rec.installed) continue
      known.get(at)?.following.stop()
      const box = join(rec.folder, SIDE, 'outbox')
      known.set(at, { rec, following: existsSync(box) ? follow(box, take(at, rec), { every }) : { stop () {} } })
    }
  }
  load()
  let watcher = null
  // catch: a folder that cannot be watched is looked at instead, every `every`
  try { watcher = fs.watch(folder, () => load()); watcher.on('error', () => {}) } catch {}
  const timer = setInterval(load, every)
  return {
    has: at => { load(); return known.has(at) },
    list: () => [...known.keys()].sort(),
    // A page asked of a component: { status, form }.
    async page (at, path, query) {
      const c = known.get(at)
      if (!c) return { status: 404, form: { error: `no component here: ${at}` } }
      if (!existsSync(join(c.rec.folder, SIDE))) return { status: 404, form: { error: `not deployed: ${at}` } }
      // its program, the first of its list, what its start hook starts: not running, said at once
      const program = c.rec.list?.[0]
      if (program && !programState(join(c.rec.folder, SIDE, 'packages', `${program}.state.json`))) return { status: 503, form: { error: `not running: ${at} (its service not started? haicc splectral/${at} service/start)` } }
      const key = guid()
      const answered = new Promise(resolve => pending.set(key, resolve))
      inboxOf(join(c.rec.folder, SIDE)).write(key, wrap(`/${c.rec.mrepo}/${SIDE}/inbox`, { ...record(TOPIC, { request: 'page', path, query }, key) }))
      let t = null
      const late = new Promise(resolve => { t = setTimeout(() => resolve(null), wait) })
      const form = await Promise.race([answered, late])
      clearTimeout(t)
      pending.delete(key)
      if (!form) {
        rmSync(join(c.rec.folder, SIDE, 'inbox', `${key}.json`), { force: true })
        return { status: 504, form: { error: `no answer in ${wait / 1000} s: is its service started? (haicc splectral/${at} service/start)` } }
      }
      return { status: 'error' in form ? 500 : 200, form }
    },
    stop () {
      clearInterval(timer)
      watcher?.close()
      for (const { following } of known.values()) following.stop()
    }
  }
}

// A data request run as a terminal runs a command: into the root mrepo's
// inbox, tagged as from outside, its completed form waited for in its
// outbox folder. -> { output } or { error }; asked with `raw: true`, also
// the response whole as its folder holds it, as the terminal reads it
// ({ record }).
export async function ask ({ boot, root, form, timeout = 120 }) {
  const at = form.at ?? '.'
  const command = Array.isArray(form.command) ? form.command : []
  if (!command.length) return { error: 'a data request names no command' }
  const parts = at === '.' ? command : ['haicc', at, ...command]
  const key = guid()
  inboxOf(boot).write(key, wrap(`/${root}/inbox`, { ...record(TOPIC, parts, key), headers: { trigger: 'external', by: 'splectral' } }))
  const back = join(boot, 'outbox', `${key}.json`)
  let arrived = () => {}
  let watcher = null
  // catch: a folder that cannot be watched is looked at instead, every 200 ms
  try { watcher = fs.watch(join(boot, 'outbox'), () => arrived()); watcher.on('error', () => {}) } catch {}
  try {
    for (const end = Date.now() + timeout * 1000; !existsSync(back);) {
      if (Date.now() >= end) return { error: `no response in ${timeout} s: ${parts.join(' ')}` }
      await new Promise(resolve => { const t = setTimeout(resolve, 200); arrived = () => { clearTimeout(t); resolve() } })
    }
    const text = readFileSync(back, 'utf8')
    const done = JSON.parse(text).value.value
    const raw = form.raw === true ? { record: text } : {}
    return 'error' in done ? { error: done.error, ...raw } : { output: done.output ?? null, ...raw }
  } finally { watcher?.close() }
}
