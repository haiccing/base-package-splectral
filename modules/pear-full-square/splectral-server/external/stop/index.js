// stop(exec): the splectral protocol's stop (README.md beside it).
import { end } from '../../internal/process/index.js'

export async function stop (exec) {
  const dir = exec.runtime.dir
  if (!dir) throw new Error('no directory in the context')
  // its process ended, waited for; none running: nothing to end
  const r = await exec.step('server', e => ({ pid: e?.pid ?? null, how: e?.how ?? null }), () => end(dir))
  exec.log('info', 'stopped', { pid: r?.pid ?? null })
  return { splectral: 'stopped', pid: r?.pid ?? null }
}
