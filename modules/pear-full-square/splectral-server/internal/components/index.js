// components: Splectral's components as the server sees them, and the
// exchange with each over its Splectral inbox and outbox (README.md
// beside it).
import fs, { existsSync, readdirSync, readFileSync, mkdirSync, rmSync } from 'bare-fs'
import { join } from 'bare-path'
import { record, guid, queueOf, keyed, drop, answered } from 'mrepo-base-request'
import { programState } from 'mrepo-base-runtime'
import { documents } from 'mycelium-container-document'
import { registry } from 'mycelium-value-avro'
import { follow } from '../records/index.js'
import { encodeAnswer, decodeAnswer } from '../typed/index.js'

// A component's Splectral side, in its mrepo's folder: its packages, its
// inbox and outbox, what was installed (component.json).
export const SIDE = 'splectral'
// Where Splectral records its components, in its own folder: a file each.
export const COMPONENTS = 'components'
export const recordOf = (dir, at) => join(dir, COMPONENTS, `${at}.json`)
// Where a completed form goes back: the topic of Splectral's requests.
export const TOPIC = '/splectral'

// A component's inbox for typed answers: its records AVRO, by the
// install's registry.
export const typedBox = rec => {
  const reg = registry(rec.schemas)
  return documents(join(rec.folder, SIDE, 'inbox'), { extension: 'avro', encode: envelope => encodeAnswer(reg, envelope), decode: bytes => decodeAnswer(reg, bytes) })
}

const completed = form => form && typeof form === 'object' && ('output' in form || 'error' in form)

// dir: Splectral's own folder; boot: the root mrepo's folder (its inbox
// the one gateway), root its unique URI; mrepos: the install's mrepos as
// the server knows them, { version, mrepos }.
export function createComponents ({ dir, boot, root, mrepos = () => ({ version: 0, mrepos: [] }), wait = 20000, timeout = 120, every = 2000 }) {
  const known = new Map()
  const pending = new Map()
  // An mrepo by its unique URI, resolved at the root from the install's
  // registry (haicc/mrepos): its position from the root, through the
  // links. Kept while the install's structure is the same.
  const resolved = new Map()
  const resolve = async uri => {
    if (typeof uri !== 'string' || !/^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)+$/.test(uri)) return { error: `not a unique URI: ${uri} (<namespace>/<name>)` }
    const id = `${mrepos().version}:${uri}`
    if (resolved.has(id)) return resolved.get(id)
    const asked = await ask({ boot, root, form: { at: '.', command: ['haicc/mrepos', uri] }, timeout })
    if ('error' in asked) return asked
    const found = (asked.output ?? []).find(m => m.uri === uri)
    if (!found) return { error: `no mrepo ${uri} in the install's registry` }
    if (found.position === null) return { error: `${uri}: not reachable from the root` }
    const answer = { output: { uri, position: found.position } }
    resolved.set(id, answer)
    return answer
  }
  const folder = join(dir, COMPONENTS)
  mkdirSync(folder, { recursive: true })
  // A component's record read; its outbox followed: a page answered, a
  // data request run, the install's mrepos said. Each record taken is
  // removed: the boxes are queues.
  // A data answer asked for typed (`as`), where the component knows the
  // install's registry (its record's `schemas`): AVRO (internal/typed);
  // else JSON, as every other record.
  const back = (rec, key, form) => {
    const envelope = keyed(`/${rec.mrepo}/${SIDE}/inbox`, record(TOPIC, form), key)
    if (typeof form.as === 'string' && rec.schemas) return typedBox(rec).write(key, envelope)
    queueOf(join(rec.folder, SIDE, 'inbox')).write(key, envelope)
  }
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
      return
    }
    if (form?.request === 'mrepo' && !completed(form)) {
      rmSync(out, { force: true })
      resolve(form.uri).then(answer => back(rec, envelope.key, { ...form, ...answer }))
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
      queueOf(join(c.rec.folder, SIDE, 'inbox')).write(key, keyed(`/${c.rec.mrepo}/${SIDE}/inbox`, record(TOPIC, { request: 'page', path, query }), key))
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
  // dropped as everyone drops a record; its answer under the same offset
  const offset = drop(boot, root, { ...record(TOPIC, parts), headers: { trigger: 'external', by: 'splectral' } })
  const text = await answered(boot, offset, { timeout })
  if (text === null) return { error: `no response in ${timeout} s: ${parts.join(' ')}` }
  const done = JSON.parse(text).value.value
  const raw = form.raw === true ? { record: text } : {}
  return 'error' in done ? { error: done.error, ...raw } : { output: done.output ?? null, ...raw }
}
