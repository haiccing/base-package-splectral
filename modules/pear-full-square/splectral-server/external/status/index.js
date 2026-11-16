// status(exec): the splectral protocol's status (README.md beside it).
import { stateOf } from '../../internal/process/index.js'

export async function status (exec) {
  const dir = exec.runtime.dir
  if (!dir) throw new Error('no directory in the context')
  const s = stateOf(dir)
  exec.log('verbose', 'state', { running: Boolean(s), url: s?.url ?? null })
  return s ? { running: true, url: s.url, pid: s.pid, outbox: s.outbox, started: s.started } : { running: false }
}
