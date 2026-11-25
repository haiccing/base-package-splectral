# records

Sums a completed record up in a line, and follows an outbox or a queue of them.

A record in an outbox folder is an envelope; in it the record as it was
sent, and in that the request's completed form: its command, its output
or its error, its log.

## Signature

- `summaryOf(envelope)`: a record's line.
- `followStream(folder, each, { every })`: an mrepo's outbox folder, a
  streaming folder: `each(envelope, file)` for every record there in
  its natural order, the oldest first, then for each that arrives: what
  came after the last one seen, a pointer.
- `follow(folder, each, { every, avro })`: a queue beside an mrepo (a
  component's side box): `each(envelope, file)` for
  every record in the folder, the oldest first, then for each that
  arrives. JSON records (`.json`); with `avro`, a decoder (bytes to the
  envelope), AVRO ones too (`.avro`).

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
- `follow`, `followStream`: `{ stop }`.

## Design

- A file is taken once. One that does not read as JSON is looked at
  again: a record is written whole and renamed into place, so that is
  not expected.
- The folder is watched, and looked at every two seconds besides: the
  net for an event missed.
