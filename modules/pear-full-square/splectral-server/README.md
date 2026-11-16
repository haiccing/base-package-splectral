# splectral-server

Splectral's server on an mrepo: an install and its commands shown in a browser as they complete.

Splectral is for seeing a running system. This is its first step on the
mrepos: one page, one subscription. A Splectral mrepo is deployed
beside the host; started, it runs a server that follows the root
mrepo's outbox folder, where every command of the install ends as a
completed record. The page shows the install as a tree and lists the
commands, the newest first. Offered by `haiccing/base-package-splectral`.

| | |
|---|---|
| [external/](external/) | the splectral protocol's actions |
| [internal/](internal/) | the server, the records, the structure, the page, the server's process |
| [test/](test/) | its tests |

`cli.js` is the server as a program: what `start` starts.

## Commands

```
haicc splectral splectral/start
haicc splectral splectral/start 4401
haicc splectral splectral/status
haicc splectral splectral/stop
```

## The page

The install, as its commands made it: its mrepos a tree, each with its
service state; a swarm's nodes under their swarm, a swarm node one node
with its container's state beside its own. It is folded from the
records: nothing is asked of the mrepos.

A line a command, whichever terminal sent it: when it completed, the
command as typed, the mrepos it was sent on to, its result (an error
with what it said), how long it took. A line opened shows its record
whole, its log in it. New lines arrive as the commands complete.

## What it serves

On `127.0.0.1`, port 4400 unless another is given; that one taken, a
free one. Read only: `GET`.

| | |
|---|---|
| `/` | the page |
| `/records` | `{ outbox, records }`: the lines so far, the oldest first, the last 500 |
| `/record/<key>` | one record whole, as its folder holds it |
| `/structure` | `{ root, nodes }`: the install's mrepos, a tree, each with its state |
| `/stream` | each new line as it arrives, and the structure when it changed (Server-Sent Events) |

## Rules

- **It reads, nothing else**: it sends no command and writes nowhere but
  its own state, `splectral.json` in its mrepo's folder.
- **One subscription**: a folder of completed records. What it follows
  is said in its status and on the page.
- **Its own process**, ended by `stop`, and by itself when its mrepo's
  runtime ends or its mrepo's folder is gone.
- **Nothing loaded from elsewhere**: the page is plain HTML, CSS and
  JavaScript, served whole.

## Config

`CONFIG`, in `internal/config.js`: the three actions at the mrepo
itself; `start` takes a port, optional.

## Tests

- `npm test`: a record summed up, a folder followed, the structure
  folded, the server asked over HTTP, the program started as a process and ended, the actions.
