# site

The Splectral site, a static page: its tabs, Splectral's own page and each component, a section's page within.

## Signature

`site({ tabs, selected, content })`: `tabs` each `{ name, label, href }`,
`href` its section's own address: Splectral's own page first
(`install`, at `/install`), then each component (`/<position>/`); `selected` the tab whose section is shown;
`content` that section's page, whole, as it was answered.

## Returns

The page, whole: HTML with its style in it.

## Errors

- No tabs: `missing argument: tabs`.

## Design

- **The URI chopped** (the team, 2026-11-19): the site serves `/`, a
  component the rest, its first name and what follows:
  `/help/hdlc/validation` is the site, the tab `help` chosen, and the
  help viewer's page `hdlc/validation` in its content area. So sections
  can nest, a component serving its part the same way.
- **Start simple**: fully static, no script of its own; the server makes
  it, for now. The site owns the tabs; a component opens its real
  estate within, its page embedded whole (`srcdoc`), its links opening
  at the top, so the address bar shows the page's own URI.
- **Relative links, always right** (the team, 2026-11-19: "with
  relative URLs always correct, irrespective of parent"): the page's
  base is its section's own address (`<base href="/help/">`), so a
  component writes its links relative to its section and never knows
  where it is mounted.
- **None selected, or one not there**: the first tab.
- **Many components**: the first five tabs shown (`SHOWN`), the rest in
  a drop-down, open when the one chosen is among them.
