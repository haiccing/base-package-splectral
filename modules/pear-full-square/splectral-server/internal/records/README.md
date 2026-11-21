# records

Sums a completed record up in a line, and follows a folder of them.

A record in an outbox folder is an envelope; in it the record as it was
sent, and in that the request's completed form: its command, its output
or its error, its log.

## Signature

- `summaryOf(envelope)`: a record's line.
- `follow(folder, each, { every })`: `each(envelope, file)` for every
  record in the folder, the oldest first, then for each that arrives.

## Returns

- `summaryOf`: `{ key, sent, done, ms, from, command, ok, error, through,
  changed }`; `null` when it is no completed record.
  - `sent`, `done`, `ms`: when it was sent, when it was completed, the
    time between.
  - `from`: who asked: the topic its answer went to.
  - `command`: as it was typed, its parts joined.
  - `ok`, `error`: its result.
  - `through`: the mrepos it was sent on to, in order, by unique URI:
    its log's `request.sent` entries. None: executed where it arrived.
  - `changed`: how many paths it changed, over all of them.
- `follow`: `{ stop }`.

## Design

- A file is taken once. One that does not read as JSON is looked at
  again: a record is written whole and renamed into place, so that is
  not expected.
- The folder is watched, and looked at every two seconds besides: the
  net for an event missed.
