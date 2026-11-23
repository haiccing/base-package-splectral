# typed

A data answer back to a component as AVRO: each level its own schema, the next carried as bytes.

The cascade, each level in AVRO's single-object encoding: the envelope
and the core (`pear-full-square/mycelium-value-avro/record`), the data
form (`pear-full-square/splectral-server/data`), its output: the schema
the component asked for (`as`) where the output is valid as it, else
`json`. Today Splectral's typed stream: `help/annotate`'s answer to the
help viewer.

## Signature

- `encodeAnswer(reg, envelope)`: the envelope around the core, its value
  the completed data form.
- `decodeAnswer(reg, bytes, { as })`: back.
- `RECORD`, `DATA`, `JSON_TYPE`: the schemas' URIs.

## Returns

- `encodeAnswer`: the bytes.
- `decodeAnswer`: the envelope as JSON holds one; the form's fields it
  did not have left out; its output read as `as` where it reads as it
  (is-like), else as written.

## Errors

A fingerprint the registry does not know (`mycelium-value-avro`).
