# splectral-server

Splectral's server on an mrepo: an install and its commands shown in a browser as they complete.

Splectral is an app platform: an mrepo of its own beside the host, its
components apps. Started, it runs a server, the data layer: it follows
the root mrepo's outbox folder and shows the install as a tree and its
commands; it serves the site, a tab each, and routes the browser to its
components, each a section at `/<position>/`, and runs the data
requests they make. Offered by
`haiccing/base-package-splectral`.

`cli.js` is the server as a program: what `start` starts.

## Links

- [external](external/)
- [internal](internal/)
- [schemas](schemas/)
- [test](test/)

## Commands

```
haicc splectral splectral/start
haicc splectral splectral/start 4401
haicc splectral splectral/status
haicc splectral splectral/stop
haicc splectral boot/deploy help haiccing/base-package-service
haicc splectral splectral/install help splectral/base-component-help-viewer
haicc splectral/help service/initialise
haicc splectral/help service/start
```

## The site

A static page, its tabs Splectral's own page (`install`) then each
component, past five the rest in a drop-down. The URI is chopped: the
site serves `/`, a component its first name and the rest:
`/help/hdlc/validation` is the site, the tab `help` chosen, the help
viewer's page `hdlc/validation` in its content area. The site owns the
tabs; a component opens its real estate within. The server's for now
(the team, 2026-11-19: "Start simple").

## The page

Its own page, `/install`. The install, as its commands made it: its mrepos a tree, each with its
service state; a swarm's nodes under their swarm, a swarm node one node
with its container's state beside its own. It is folded from the
records: nothing is asked of the mrepos.

A line a command, whichever terminal sent it: when it completed, the
command as typed, the mrepos it was sent on to, its result (an error
with what it said), how long it took. A line opened shows its record
whole, its log in it. New lines arrive as the commands complete.

## What it serves

On `127.0.0.1`, port 4400 unless another is given; that one taken, a
free one. `GET` only.

| | |
|---|---|
| `/` | the page |
| `/records` | `{ outbox, records }`: the lines so far, the oldest first, the last 500 |
| `/record/<key>` | one record whole, as its folder holds it |
| `/structure` | `{ root, nodes }`: the install's mrepos, a tree, each with its state |
| `/stream` | each new line as it arrives, and the structure when it changed (Server-Sent Events) |
| `/<position>/<path>` | a component's page: asked of it through its Splectral inbox (`internal/components`) |

## Rules

- **The data layer**: it sends the commands its components ask for, as
  a terminal sends them, into the root mrepo's inbox; it writes its own
  state, `splectral.json` in its mrepo's folder, and the components'
  Splectral inboxes. It interprets nothing of a component's.
- **One subscription**: a folder of completed records. What it follows
  is said in its status and on the page.
- **Its own process**, ended by `stop`, and by itself when its mrepo's
  runtime ends or its mrepo's folder is gone.
- **Nothing loaded from elsewhere**: the page is plain HTML, CSS and
  JavaScript, served whole.

## Tests

- `brittle-bare test/*.test.js` (Bare installed): a record summed up, a folder followed, the structure
  folded, the server asked over HTTP, the program started as a process and ended, the actions, a
  component's page asked through its boxes, its data request run.
