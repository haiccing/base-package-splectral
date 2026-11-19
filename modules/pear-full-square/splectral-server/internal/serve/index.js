// serve: Splectral's server, in this process: the page, the records of a
// folder followed, each new one streamed, the install's structure folded
// from them (README.md beside it).
import http from 'bare-http1'
import { readFileSync, existsSync } from 'bare-fs'
import { join, dirname } from 'bare-path'
import { URL } from 'bare-url'
import { summaryOf, follow } from '../records/index.js'
import { createStructure } from '../structure/index.js'
import { PAGE } from '../page/index.js'
import { createComponents } from '../components/index.js'

// Where it is served when nothing else is said: this machine only.
export const PORT = 4400
export const HOST = '127.0.0.1'
// The root mrepo's unique URI when none is said.
export const ROOT = 'local/boot'
// The server's own paths: no component is named so.
export const RESERVED = ['records', 'record', 'structure', 'stream', 'index.html']
const KEY = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

// The server listening: on the port asked for; that one taken (and
// another allowed): on a free one.
function listen (server, port, host, other) {
  return new Promise((resolve, reject) => {
    const failed = err => {
      if (err.code === 'EADDRINUSE' && other && port !== 0) { server.removeListener('error', failed); resolve(listen(server, 0, host, false)); return }
      reject(new Error(`not served at ${host}:${port}: ${err.message}`, { cause: err }))
    }
    server.once('error', failed)
    server.listen(port, host, () => { server.removeListener('error', failed); resolve(server.address().port) })
  })
}

export async function serve ({ outbox, dir = null, root = ROOT, port = PORT, host = HOST, other = true, keep = 500, every = 2000, wait = 20000 }) {
  // Its components, where it has a folder of its own: each at its URI.
  const components = dir ? createComponents({ dir, boot: dirname(outbox), root, wait, every }) : null
  // The lines shown: a record a line, the oldest first, the last `keep`.
  const lines = []
  const files = new Map()
  const clients = new Set()
  // The install as the records made it: every record folded, also those
  // no longer among the lines.
  const structure = createStructure(root)
  const following = follow(outbox, (envelope, file) => {
    const line = summaryOf(envelope)
    if (!line) return
    const changed = structure.apply(envelope)
    lines.push(line)
    files.set(line.key, file)
    while (lines.length > keep) files.delete(lines.shift().key)
    for (const res of clients) {
      res.write(`data: ${JSON.stringify(line)}\n\n`)
      if (changed) res.write(`event: structure\ndata: ${JSON.stringify({ ...structure.snapshot(), changed })}\n\n`)
    }
  }, { every })
  const json = (res, code, value) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)) }
  const sockets = new Set()
  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname
    if (req.method !== 'GET') return json(res, 405, { error: 'GET only' })
    if (path === '/' || path === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE) }
    if (path === '/records') return json(res, 200, { outbox, records: lines })
    if (path === '/structure') return json(res, 200, structure.snapshot())
    if (path === '/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
      res.write(': splectral\n\n')
      clients.add(res)
      // (the response's close, not the request's: a request with no body
      // has ended before its stream does)
      res.on('close', () => clients.delete(res))
      return
    }
    // one record whole, as its folder holds it
    if (path.startsWith('/record/')) {
      const key = path.slice('/record/'.length)
      const file = KEY.test(key) ? files.get(key) : null
      if (!file || !existsSync(join(outbox, file))) return json(res, 404, { error: 'no such record' })
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(readFileSync(join(outbox, file)))
    }
    // a component's: its first name the component, the rest the page's path
    const names = path.split('/').filter(Boolean).map(n => decodeURIComponent(n))
    if (components && names.length && components.has(names[0])) {
      const query = Object.fromEntries(new URL(req.url, 'http://x').searchParams)
      components.page(names[0], names.slice(1).join('/'), query).then(({ status, form }) => {
        if ('error' in form) { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }); return res.end(errorPage(names[0], form.error)) }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(String(form.output ?? ''))
      }, err => json(res, 500, { error: err.message }))
      return
    }
    json(res, 404, { error: 'nothing here' })
  })
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  let at
  try { at = await listen(server, port, host, other) } catch (err) { following.stop(); throw err }
  return {
    url: `http://${host}:${at}`,
    port: at,
    outbox,
    root,
    records: () => [...lines],
    structure: () => structure.snapshot(),
    clients: () => clients.size,
    components: () => components?.list() ?? [],
    async close () {
      following.stop()
      components?.stop()
      for (const res of clients) res.end()
      clients.clear()
      const closed = new Promise(resolve => server.close(resolve))
      // (its connections ended: a stream stays open otherwise)
      for (const socket of sockets) socket.destroy()
      await closed
    }
  }
}

// A component's page that could not be made: what was said, plainly.
const escape = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
function errorPage (at, error) {
  return `<!doctype html><meta charset="utf-8"><title>${escape(at)}</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem}code{font-size:.9em}</style><h1>${escape(at)}</h1><p>The page could not be made.</p><pre><code>${escape(error)}</code></pre><p><a href="/">Splectral</a></p>`
}
