// site: the Splectral site, a static page: its tabs, Splectral's own page
// and each component, and the section of the URI asked for in its
// content area (README.md beside it).

// More tabs than this: the rest in a drop-down.
export const SHOWN = 5

const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const STYLE = `
:root{--bg:#fff;--fg:#1d1f23;--muted:#5f6670;--line:#e3e6ea;--accent:#2457c5;--tab:#f4f5f7}
@media (prefers-color-scheme:dark){:root{--bg:#16181c;--fg:#e6e8eb;--muted:#9aa2ad;--line:#2c3036;--accent:#7fa6ff;--tab:#202329}}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;display:flex;flex-direction:column;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}
header{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem;padding:.4rem .75rem 0;border-bottom:1px solid var(--line)}
header .name{font-weight:600;margin-right:.75rem}
nav{display:flex;flex-wrap:wrap;gap:.25rem;align-items:flex-end}
nav a,summary{display:block;padding:.4rem .8rem;border:1px solid transparent;border-bottom:none;border-radius:6px 6px 0 0;color:var(--accent);text-decoration:none;cursor:pointer}
nav a.on{background:var(--bg);border-color:var(--line);color:var(--fg);margin-bottom:-1px}
details{position:relative}details ul{position:absolute;z-index:1;list-style:none;margin:0;padding:.25rem 0;min-width:10rem;background:var(--bg);border:1px solid var(--line);border-radius:6px}
details li a{border:none;border-radius:0}
iframe{flex:1;width:100%;border:0;background:var(--bg)}
`

// A section's page, embedded whole (srcdoc): only & and " escaped; its
// base its section's own address, so its relative links are right
// wherever it is mounted, and open at the top, so the address bar shows
// the page's own URI.
const embedded = (html, mount) => {
  const page = String(html ?? '')
  const base = `<base href="${escape(mount)}" target="_top">`
  const based = /<head[^>]*>/i.test(page) ? page.replace(/<head[^>]*>/i, m => `${m}${base}`) : `${base}${page}`
  return based.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

// tabs: [{ name, label, href }], Splectral's own first, href a section's
// own address; selected: the tab whose section is shown (none, or one not
// there: the first); content: that section's page, whole. -> HTML
export function site ({ tabs, selected = null, content = '' } = {}) {
  if (!Array.isArray(tabs) || !tabs.length) throw new Error('missing argument: tabs')
  const on = tabs.find(t => t.name === selected) ?? tabs[0]
  const link = t => `<a href="${escape(t.href)}"${t === on ? ' class="on" aria-current="page"' : ''}>${escape(t.label ?? t.name)}</a>`
  const shown = tabs.slice(0, SHOWN)
  const rest = tabs.slice(SHOWN)
  const more = rest.length ? `<details${rest.includes(on) ? ' open' : ''}><summary>more (${rest.length})</summary><ul>${rest.map(t => `<li>${link(t)}</li>`).join('')}</ul></details>` : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Splectral · ${escape(on.label ?? on.name)}</title><style>${STYLE}</style></head><body><header><span class="name">Splectral</span><nav>${shown.map(link).join('')}${more}</nav></header><iframe title="${escape(on.label ?? on.name)}" srcdoc="${embedded(content, on.href)}"></iframe></body></html>`
}
