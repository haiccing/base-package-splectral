// page: the one page Splectral serves (README.md beside it). Plain HTML,
// CSS and JavaScript, nothing loaded from elsewhere: the install, its
// mrepos a tree, each with its state; and its commands, the newest first,
// each a line; a line opened shows its record.
export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Splectral</title>
<style>
  :root { --bg: #f7f6f2; --panel: #ffffff; --ink: #1c1b18; --soft: #6b675e; --line: #e2dfd6; --ok: #2f7d4f; --warn: #8a6410; --bad: #b3372a; --mark: #efece3; --accent: #3b5b8c; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #15161a; --panel: #1d1f25; --ink: #e9e7e1; --soft: #9a978e; --line: #2c2f38; --ok: #6cc08b; --warn: #d9b25c; --bad: #ee8275; --mark: #262932; --accent: #8fb0e6; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; padding: 16px 20px 12px; border-bottom: 1px solid var(--line); }
  h1 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: 0.01em; }
  header .what { color: var(--soft); }
  header .state { margin-left: auto; color: var(--soft); font-variant-numeric: tabular-nums; }
  header .state b { font-weight: 600; color: var(--ink); }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--soft); margin-right: 6px; }
  .dot.live { background: var(--ok); }
  main { padding: 12px 20px 40px; }
  h2 { margin: 18px 0 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--soft); }
  h2:first-child { margin-top: 4px; }
  .tree { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 6px 0; }
  .node { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; padding: 5px 12px; }
  .node .name { font-weight: 600; }
  .node .uri { color: var(--soft); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }
  .node.group .name { font-weight: 500; color: var(--soft); }
  .badge { font-size: 12px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--soft); white-space: nowrap; }
  .badge.on { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); }
  .badge.half { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, transparent); }
  .node.fresh { animation: fresh 1.6s ease-out; }
  .from { color: var(--soft); font-size: 12px; margin-bottom: 10px; overflow-wrap: anywhere; }
  .empty { color: var(--soft); padding: 24px 0; }
  .scroll { overflow-x: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; min-width: 760px; }
  th, td { text-align: left; padding: 7px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--soft); }
  tbody tr.line { cursor: pointer; }
  tbody tr.line:hover, tbody tr.line.open { background: var(--mark); }
  tbody tr:last-child td { border-bottom: 0; }
  td.time, td.ms { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--soft); }
  td.ms { text-align: right; }
  th.ms { text-align: right; }
  td.command { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; overflow-wrap: anywhere; min-width: 20em; }
  td.through { color: var(--soft); white-space: nowrap; }
  td.ok, td.bad { min-width: 9em; }
  .ok { color: var(--ok); font-weight: 600; }
  .bad { color: var(--bad); font-weight: 600; }
  .why { color: var(--bad); font-size: 12px; margin-top: 2px; overflow-wrap: anywhere; }
  tr.record td { background: var(--mark); padding: 0; }
  pre { margin: 0; padding: 12px 14px; max-height: 420px; overflow: auto; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
  tr.fresh td { animation: fresh 1.6s ease-out; }
  @keyframes fresh { from { background: color-mix(in srgb, var(--accent) 22%, transparent); } to { background: transparent; } }
  @media (prefers-reduced-motion: reduce) { tr.fresh td, .node.fresh { animation: none; } }
</style>
</head>
<body>
<header>
  <h1>Splectral</h1>
  <span class="what">this install, and its commands as they complete</span>
  <span class="state"><span class="dot" id="dot"></span><span id="live">connecting</span> &middot; <b id="count">0</b> commands</span>
</header>
<main>
  <h2>the install</h2>
  <div class="tree" id="tree"></div>
  <h2>its commands</h2>
  <div class="from" id="from"></div>
  <div class="empty" id="empty">No command yet. Send one with haicc and it shows here.</div>
  <div class="scroll" id="scroll" hidden>
    <table>
      <thead><tr><th>completed</th><th>command</th><th>through</th><th>result</th><th class="ms">ms</th></tr></thead>
      <tbody id="lines"></tbody>
    </table>
  </div>
</main>
<script>
  var lines = document.getElementById('lines')
  var seen = {}
  var count = 0
  function cell (cls, text) { var td = document.createElement('td'); td.className = cls; td.textContent = text; return td }
  function time (iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0') }
  function close (tr) { if (tr.nextSibling && tr.nextSibling.className === 'record') tr.nextSibling.remove(); tr.classList.remove('open') }
  function open (tr, key) {
    if (tr.classList.contains('open')) return close(tr)
    tr.classList.add('open')
    var row = document.createElement('tr'); row.className = 'record'
    var td = document.createElement('td'); td.colSpan = 5
    var pre = document.createElement('pre'); pre.textContent = 'reading'
    td.appendChild(pre); row.appendChild(td); tr.after(row)
    fetch('/record/' + key).then(function (r) { return r.json() }).then(function (record) { pre.textContent = JSON.stringify(record, null, 2) }, function () { pre.textContent = 'not there any more' })
  }
  function add (line, fresh) {
    if (seen[line.key]) return
    seen[line.key] = true
    count++
    var tr = document.createElement('tr'); tr.className = 'line' + (fresh ? ' fresh' : '')
    tr.appendChild(cell('time', time(line.done)))
    tr.appendChild(cell('command', line.command))
    tr.appendChild(cell('through', line.through.length ? line.through.join(' \\u2192 ') : 'here'))
    var result = cell(line.ok ? 'ok' : 'bad', line.ok ? 'ok' : 'error')
    if (!line.ok && line.error) { var why = document.createElement('div'); why.className = 'why'; why.textContent = line.error; result.appendChild(why) }
    tr.appendChild(result)
    tr.appendChild(cell('ms', line.ms === null ? '' : String(line.ms)))
    tr.addEventListener('click', function () { open(tr, line.key) })
    lines.insertBefore(tr, lines.firstChild)
    document.getElementById('count').textContent = count
    document.getElementById('empty').hidden = true
    document.getElementById('scroll').hidden = false
  }
  // the install: its mrepos, a tree; a swarm's nodes under their swarm
  function badge (cls, text) { var b = document.createElement('span'); b.className = 'badge' + (cls ? ' ' + cls : ''); b.textContent = text; return b }
  function row (depth, cls) { var d = document.createElement('div'); d.className = 'node' + (cls ? ' ' + cls : ''); d.style.paddingLeft = (12 + depth * 22) + 'px'; return d }
  function span (cls, text) { var e = document.createElement('span'); e.className = cls; e.textContent = text; return e }
  function tree (structure) {
    var box = document.getElementById('tree')
    box.textContent = ''
    var swarms = {}
    var deeper = {}
    structure.nodes.forEach(function (n) {
      var depth = n.depth + (deeper[n.parent] || 0)
      var names = n.at.split('/')
      var swarm = names.length === 3 && names[0] === 'swarms' ? names[1] : null
      if (swarm) {
        if (swarms[n.parent] !== swarm) { swarms[n.parent] = swarm; var g = row(depth, 'group'); g.appendChild(span('name', 'swarm ' + swarm)); box.appendChild(g) }
        depth++
      }
      deeper[n.uri] = depth - n.depth
      var d = row(depth, n.uri === structure.changed ? 'fresh' : '')
      d.appendChild(span('name', n.parent === null ? n.uri.split('/').pop() : n.at.split('/').pop()))
      d.appendChild(span('uri', n.uri))
      if (n.parent === null) d.appendChild(badge('', 'the root'))
      else d.appendChild(badge(n.service === 'started' ? 'on' : n.service === 'initialised' ? 'half' : '', n.service || 'deployed'))
      if (n.container) d.appendChild(badge(n.container.state === 'running' ? 'on' : n.container.state === 'exited' ? 'half' : '', 'container ' + n.container.state + (n.container.service ? ', ' + n.container.service : '')))
      box.appendChild(d)
    })
  }
  fetch('/structure').then(function (r) { return r.json() }).then(tree)
  function live (on) { document.getElementById('dot').className = 'dot' + (on ? ' live' : ''); document.getElementById('live').textContent = on ? 'live' : 'not connected' }
  fetch('/records').then(function (r) { return r.json() }).then(function (all) {
    document.getElementById('from').textContent = 'following ' + all.outbox
    all.records.forEach(function (line) { add(line, false) })
    var stream = new EventSource('/stream')
    stream.onopen = function () { live(true) }
    stream.onerror = function () { live(false) }
    stream.onmessage = function (m) { add(JSON.parse(m.data), true) }
    stream.addEventListener('structure', function (m) { tree(JSON.parse(m.data)) })
  })
</script>
</body>
</html>
`
