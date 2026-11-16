// start(exec, { args: [port?] }): the splectral protocol's start (README.md beside it).
import process from 'bare-process'
import { existsSync } from 'bare-fs'
import { join } from 'bare-path'
import { viewOf, setting, OUTBOX } from 'mrepo-base-request'
import { launch, stateOf } from '../../internal/process/index.js'
import { PORT } from '../../internal/serve/index.js'

// The package whose bundle is the server's program.
const PACKAGE = 'haiccing/base-package-splectral'

// (program: what Bare is started with, when it is not the package's bundle: a test's)
export async function start (exec, { args = [] } = {}, { program = null } = {}) {
  const dir = exec.runtime.dir
  if (!dir) throw new Error('no directory in the context')
  const was = stateOf(dir)
  if (was) { exec.log('verbose', 'running already', { url: was.url, pid: was.pid }); return { splectral: 'started', url: was.url, pid: was.pid, outbox: was.outbox } }
  const port = args[0] === undefined ? PORT : Number(args[0])
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`not a port: ${args[0]}`)
  // What it follows: the root mrepo's outbox folder, where every command
  // of the install ends as a completed record.
  const work = exec.runtime.work
  if (!work) throw new Error('no work folder in the context: no root mrepo to follow')
  const name = setting(work).name
  const outbox = join(viewOf(work, name), OUTBOX)
  // (the root mrepo's unique URI: in the swarm this mrepo is in)
  const root = `${typeof exec.runtime.uri === 'string' && exec.runtime.uri.includes('/') ? exec.runtime.uri.split('/')[0] : 'local'}/${name}`
  if (!existsSync(outbox)) throw new Error(`nothing to follow: ${outbox} (the root mrepo's outbox folder)`)
  const file = program ?? join(dir, 'packages', `${PACKAGE}.bundle`)
  if (!existsSync(file)) throw new Error(`no server to start: ${PACKAGE} is not among the mrepo's packages`)
  // Its own process, ended with this mrepo's runtime.
  const s = await exec.step('server', r => ({ url: r?.url ?? null, pid: r?.pid ?? null }), () => launch({ program: file, dir, outbox, root, port, runtime: process.pid }))
  if (!s) throw new Error('its server did not start')
  exec.log('info', 'started', { url: s.url, outbox })
  return { splectral: 'started', url: s.url, pid: s.pid, outbox }
}
