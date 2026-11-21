// records: a completed record summed up in a line, and a folder of them
// followed (README.md beside it).
import fs, { readdirSync, readFileSync, existsSync } from 'bare-fs'
import { join } from 'bare-path'

// A completed record as an outbox holds it: its envelope, in it the
// record as it was sent (who asked, when), in that its completed form.
// -> its line: null when it is none (a layer's own config, a record not
// completed).
export function summaryOf (envelope) {
  const core = envelope?.value
  const form = core?.value
  if (!form || typeof form !== 'object' || Array.isArray(form) || !('output' in form || 'error' in form)) return null
  const log = Array.isArray(form.log) ? form.log : []
  const ms = Date.parse(envelope.timestamp) - Date.parse(core.timestamp)
  return {
    key: envelope.key,
    // when it was sent and when it was completed; how long between
    sent: core.timestamp,
    done: envelope.timestamp,
    ms: Number.isFinite(ms) ? ms : null,
    // who asked (the topic the answer went to)
    from: core.topic ?? null,
    command: Array.isArray(form.command) ? form.command.join(' ') : `${form.protocol}/${form.action}`,
    ok: !('error' in form),
    error: form.error ?? null,
    // the mrepos it was sent on to, in order, and how much it changed
    through: log.filter(e => e.event === 'request.sent' && e.mrepo).map(e => e.mrepo),
    changed: log.filter(e => e.event === 'request.changed').reduce((n, e) => n + (e.count ?? 0), 0)
  }
}

// A folder of records followed: each(envelope, file) for every record
// there, the oldest first, then for each that arrives; a file once.
// -> { stop }
export function follow (folder, each, { every = 2000 } = {}) {
  const seen = new Set()
  let stopped = false
  const look = () => {
    if (stopped || !existsSync(folder)) return
    const found = []
    for (const name of readdirSync(folder)) {
      if (seen.has(name) || !name.endsWith('.json')) continue
      let envelope = null
      // catch: not whole yet, or not JSON: looked at again the next time
      try { envelope = JSON.parse(readFileSync(join(folder, name), 'utf8')) } catch { continue }
      seen.add(name)
      found.push([envelope, name])
    }
    found.sort((a, b) => String(a[0]?.timestamp).localeCompare(String(b[0]?.timestamp)))
    for (const [envelope, name] of found) each(envelope, name)
  }
  look()
  // told when something arrives; and a slow look, the net for an event missed
  let watcher = null
  // catch: a folder that cannot be watched is looked at instead, every `every`
  try { watcher = fs.watch(folder, () => look()); watcher.on('error', () => {}) } catch {}
  const timer = setInterval(look, every)
  return { stop: () => { stopped = true; clearInterval(timer); if (watcher) watcher.close() } }
}
