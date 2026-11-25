// pair: a child deployed into a Docker container, on the container's own
// haicc install (README.md beside it). The container's platform executes
// the platform commands on it; this mrepo links it and forwards to it.
import os from 'bare-os'
import { existsSync, mkdirSync, cpSync, rmSync, readFileSync } from 'bare-fs'
import { join, dirname, relative } from 'bare-path'
import crypto from 'bare-crypto'
import { spawnSync } from 'bare-subprocess'
import { record, drop, answered } from 'mrepo-base-request'

// Where the pairs are, under the work folder, by the child's unique URI:
// each the container's haicc home, mounted into it.
export const PAIRS = 'containers'
// The image a pair's container is made from: a plain base, nothing of
// haicc in it.
export const IMAGE = 'debian:bookworm-slim'
// Where the container's haicc home is seen inside it.
export const HOME = '/haicc'
// The container's boot mrepo, its folder in its work folder, its address.
const BOOT = join('work', 'mrepos', 'boot')
const BOOT_URI = 'local/boot'
// Where the container's platform answers to: the pair's outside.
const REPLY = '/haicc/pair'
// How long the container is given to install and boot, and a platform
// command to be answered (s).
const WAIT = 180

const last = text => text.split('\n').filter(Boolean).pop() ?? ''
// log: none (one call of Docker's command line; its callers say what they did)
function docker (...args) {
  const r = spawnSync('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] })
  return { ok: r.status === 0, out: (r.stdout ?? '').toString().trim(), err: r.error ? r.error.message : (r.stderr ?? '').toString().trim() }
}

// A child's pair: its folder (the container's haicc home, as this host
// sees it), the folders of the container's boot mrepo and of the child in
// it, each also relative to this mrepo's folder, its container's name.
// log: none (a description)
export function pairOf (exec, c) {
  const work = exec.runtime.work
  if (!work) throw new Error('no work folder in the context: a pair is made beside the mrepos')
  const dir = join(work, PAIRS, c.mrepo)
  const boot = join(dir, BOOT)
  const node = join(dir, 'work', 'mrepos', c.mrepo)
  const name = `haicc-pair-${c.mrepo.replace(/\//g, '-')}-${crypto.createHash('sha256').update(dir).digest('hex').slice(0, 8)}`
  const mine = exec.runtime.dir
  return { dir, boot, node, name, folder: relative(mine, node), platform: relative(mine, boot), home: dirname(work) }
}

// One platform command for the container's: dropped into its boot
// mrepo's inbox, its completed form waited for in its outbox.
// -> its completed form; throws on none in time
// log: none (the caller's step says what was sent and what came back)
async function platform (p, parts, { timeout = WAIT } = {}) {
  // (a reply topic: a request without one is answered to nobody, its
  // completed form not written to the outbox)
  const offset = drop(p.boot, BOOT_URI, { ...record(REPLY, parts), headers: { trigger: 'external' } })
  // time: the wait for another install's answer, bounded; past the bound, said
  const back = await answered(p.boot, offset, { timeout })
  if (back === null) throw new Error(`the container's platform did not answer in ${timeout} s: ${parts.join(' ')}`)
  return JSON.parse(back).value.value
}
// A platform command whose failure is the action's
// log: none (as platform)
async function must (p, parts) {
  const form = await platform(p, parts)
  if (form.error) throw new Error(`in the container: ${parts.join(' ')}: ${form.error.message ?? form.error}`)
  return form.output
}

// The pair made: its folder, the host's install copied in (the scripts and
// the pins: the same haicc), the container made and started from a plain
// image, the host's sources mounted read only at their own paths; in it,
// the install's sources linked, Bare put in place, its boot; then the child
// deployed there by the container's platform, at the same position, by
// the same unique URI. -> { container, image, folder, platform }
// log: steps container, boot, deploy (each with what it did)
export async function deployPair (exec, c, { target, sources }) {
  const p = pairOf(exec, c)
  if (existsSync(p.dir)) throw new Error(`in the way: ${p.dir}`)
  for (const f of ['bin', 'pins']) if (!existsSync(join(p.home, f))) throw new Error(`no haicc install beside the work folder: ${join(p.home, f)}`)
  const folders = sources.filter(s => s.kind === 'folder').map(s => s.path)
  let made = false
  try {
    mkdirSync(p.dir, { recursive: true })
    cpSync(join(p.home, 'bin'), join(p.dir, 'bin'), { recursive: true })
    cpSync(join(p.home, 'pins'), join(p.dir, 'pins'))
    // The container: its home the pair's folder; the sources read only;
    // the host's user; --init, which reaps a runtime that ended (without
    // it a stopped one stays a zombie and counts as running). Its command
    // links the sources, puts Bare in place and boots, every time it
    // starts, then stays.
    const start = 'set -e; for s in "$@"; do sh /haicc/bin/haicc sources link "$s" >/dev/null; done; sh /haicc/bin/haicc prereq >/dev/null; sh /haicc/bin/haicc boot/deploy >/dev/null; exec sleep infinity'
    const { uid, gid } = os.userInfo()
    const args = ['run', '-d', '--init', '--name', p.name,
      '--label', `haicc.mrepo=${c.mrepo}`, '--label', `haicc.folder=${p.dir}`,
      '--user', `${uid}:${gid}`, '-e', `HOME=${HOME}`, '-e', `HAICC_HOME=${HOME}`,
      '-v', `${p.dir}:${HOME}`, ...folders.flatMap(f => ['-v', `${f}:${f}:ro`]),
      '--entrypoint', 'sh', IMAGE, '-c', start, 'sh', ...folders]
    await exec.step('container', { container: p.name, image: IMAGE }, async () => {
      const r = docker(...args)
      if (!r.ok) throw new Error(`its container was not made: ${p.name}: ${last(r.err)}`)
      made = true
    })
    // Booted when its boot mrepo's inbox is there: what is dropped there
    // waits until its runtime takes it in.
    await exec.step('boot', { at: p.boot }, async () => {
      // time: the wait for the container's boot, bounded
      for (const end = Date.now() + WAIT * 1000; !existsSync(join(p.boot, 'inbox'));) {
        const state = docker('inspect', '--format', '{{.State.Status}}', p.name).out
        // time: past the bound, or the container gone, said
        if (state !== 'running' || Date.now() >= end) throw new Error(`its container did not boot: ${p.name} (${state || 'gone'}): ${last(docker('logs', '--tail', '5', p.name).err)}`)
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    })
    // The child, by the container's platform: the namespace's node above
    // it made there with its document, then the child at its position.
    const output = await exec.step('deploy', o => ({ at: c.at, deployed: o?.deployed ?? null }), async () => {
      if (c.nsAt) await must(p, ['crud/create', c.nsAt, JSON.stringify({ kind: c.kind })])
      return must(p, ['boot/deploy', c.at, target])
    })
    return { container: { name: p.name, image: IMAGE }, folder: p.folder, platform: p.platform, pair: relative(exec.runtime.dir, p.dir), packages: output?.packages ?? [] }
  } catch (err) {
    // nothing of it left: its container, when it was made, and its folder
    if (made) docker('rm', '-f', p.name)
    rmSync(p.dir, { recursive: true, force: true })
    throw err
  }
}

// The pair torn down: the child by the container's platform, then the
// container removed and its folder. A container that is gone: its folder
// removed all the same. -> { container, platform: what the container's
// platform answered, or null }
// log: steps platform, container (each with what it did)
export async function teardownPair (exec, c, recorded) {
  const p = pairOf(exec, c)
  const name = recorded.container?.name ?? p.name
  const running = docker('inspect', '--format', '{{.State.Status}}', name).out === 'running'
  const answered = running ? await exec.step('platform', f => ({ at: c.at, error: f?.error?.message ?? null }), () => platform(p, ['boot/teardown', c.at])) : null
  await exec.step('container', { container: name, running }, async () => {
    docker('rm', '-f', name)
    rmSync(p.dir, { recursive: true, force: true })
  })
  return { container: name, platform: answered ? (answered.error ? { error: answered.error.message ?? answered.error } : answered.output) : null }
}
