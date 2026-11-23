// typed: a data answer back to a component as AVRO, the cascade: the
// envelope and the core (mycelium's record), the data form (Data, this
// module's), its output (as the component asked for it, or json)
// (README.md beside it).
import { encode, decode, unfold, isSingle, isLike, fingerprintIn } from 'mycelium-value-avro'

export const RECORD = 'pear-full-square/mycelium-value-avro/record'
export const JSON_TYPE = 'pear-full-square/mycelium-value-avro/json'
export const DATA = 'pear-full-square/splectral-server/data'

const valid = (reg, uri, v) => { const t = reg.latest(uri); return Boolean(t) && t.isValid(v) }

// envelope: { topic, key, timestamp, headers, value: core }, the core's
// value the completed data form. -> bytes; its output as `form.as` when it
// is valid as that (else json: the reader's question, at read time).
export function encodeAnswer (reg, envelope) {
  const core = envelope.value
  const form = core.value
  const as = typeof form.as === 'string' && valid(reg, form.as, form.output) ? form.as : JSON_TYPE
  const output = 'output' in form ? encode(reg, as, form.output) : null
  const data = encode(reg, DATA, { ...form, command: form.command ?? [], output })
  return encode(reg, RECORD, { ...envelope, value: encode(reg, RECORD, { ...core, value: data }) })
}

// bytes -> the envelope, as JSON holds one: the output read as `as` (the
// schema the component needs) when it reads as it (is-like), else as
// written; the fields the form did not have left out.
export function decodeAnswer (reg, bytes, { as = null } = {}) {
  const envelope = decode(reg, bytes)
  const core = decode(reg, envelope.value)
  const form = decode(reg, core.value)
  const out = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== null && k !== 'output'))
  if (isSingle(form.output)) out.output = plainOf(unfold(reg, form.output), as && like(reg, form.output, as) ? decode(reg, form.output, { as }) : null)
  return { ...envelope, value: { ...core, value: out } }
}
// (whether an output reads as a schema; one not known here: it does not)
const like = (reg, bytes, as) => {
  // catch: a schema not known here (the writer's or the one asked for): it does not read as it
  try { return isLike(reg, fingerprintIn(bytes), as).like } catch { return false }
}
// (a record's fields as plain values: read as asked when asked)
const plainOf = (written, asked) => JSON.parse(JSON.stringify(asked ?? written))

