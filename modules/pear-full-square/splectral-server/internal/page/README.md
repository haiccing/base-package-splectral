# page

The one page Splectral serves: the commands of the install, the newest first.

## Signature

`PAGE`: the page, as text.

## Design

- One file's worth of HTML, CSS and JavaScript, nothing loaded from
  elsewhere, no build step.
- It asks `/records` for the lines so far, then listens on `/stream`.
  A line: when it completed, the command, the mrepos it went through,
  its result (an error with what it said), its milliseconds.
- A line opened shows its record whole, from `/record/<key>`.
- Light and dark follow the browser; a narrow screen scrolls the table,
  not the page.
- What a record says is written as text, never as markup.
