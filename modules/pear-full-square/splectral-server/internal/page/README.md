# page

The one page Splectral serves: the install as a tree, and its commands, the newest first.

## Signature

`PAGE`: the page, as text.

## Design

- One file's worth of HTML, CSS and JavaScript, nothing loaded from
  elsewhere, no build step.
- The install: its mrepos a tree, from `/structure`, drawn again when
  the stream says it changed. A node: its name, its unique URI, its
  service state; a swarm's nodes under their swarm, each with its
  container's state. A state is said in words, its colour beside it.
- It asks `/records` for the lines so far, then listens on `/stream`.
  A line: when it completed, the command, the mrepos it went through,
  its result (an error with what it said), its milliseconds.
- A line opened shows its record whole, from `/record/<key>`.
- Light and dark follow the browser; a narrow screen scrolls the table,
  not the page.
- What a record says is written as text, never as markup.
