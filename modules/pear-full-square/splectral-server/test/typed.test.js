// A data answer back to a component typed: the cascade written as AVRO,
// read back; followed in a folder beside JSON records.
import test from 'brittle'
import { mkdtempSync, rmSync, readFileSync } from 'bare-fs'
import { join, dirname } from 'bare-path'
import { tmpdir } from 'bare-os'
import { fileURLToPath } from 'bare-url'
import { registry, decode, fingerprintIn } from 'mycelium-value-avro'
import { record, keyed } from 'mrepo-base-request'
import { encodeAnswer, decodeAnswer, typedBox, follow, SIDE } from '../index.js'

const here = join(dirname(fileURLToPath(import.meta.url)), '..')
const ANSWER = { type: 'record', name: 'haiccing.basePackageHelp.annotateAnswer', fields: [{ name: 'help', type: 'string' }, { name: 'answer', type: { type: 'array', items: 'string' } }] }

test('typed: a data answer as AVRO, each level its own schema, read back; as asked when it is like it, else as written', (t) => {
  const reg = registry()
  reg.add(ANSWER)
  reg.add(JSON.parse(readFileSync(join(here, 'schemas', 'data.json'), 'utf8')))
  const form = { request: 'data', at: 'host', command: ['crud/read', 'x', '--flags', 'help'], as: 'haiccing/base-package-help/annotate-answer', output: { help: 'crud/read x', answer: ['a line'] } }
  const envelope = keyed('/local/help/splectral/inbox', record('/splectral', form), 'k1')
  const bytes = encodeAnswer(reg, envelope)
  const levels = [decode(reg, bytes)]
  levels.push(decode(reg, levels[0].value), null)
  levels[2] = decode(reg, levels[1].value)
  t.alike(levels.map(l => reg.get(fingerprintIn(l.value ?? l.output))?.uri), ['pear-full-square/mycelium-value-avro/record', 'pear-full-square/splectral-server/data', 'haiccing/base-package-help/annotate-answer'], 'the record, the core, the data form, the answer: each level by its own schema')
  t.alike(JSON.parse(JSON.stringify(decodeAnswer(reg, bytes))), JSON.parse(JSON.stringify(envelope)), 'read back: the envelope as JSON holds it')
  const notLike = encodeAnswer(reg, keyed('/x', record('/splectral', { ...form, output: { run: false, why: ['no'] } }), 'k2'))
  t.is(reg.get(fingerprintIn(decode(reg, decode(reg, decode(reg, notLike).value).value).output)).uri, 'pear-full-square/mycelium-value-avro/json', 'an output that is not valid as asked: json')
  t.alike(decodeAnswer(reg, notLike, { as: 'haiccing/base-package-help/annotate-answer' }).value.value.output, { run: false, why: ['no'] }, 'read as written where it does not read as asked')
  const err = encodeAnswer(reg, keyed('/x', record('/splectral', { request: 'data', at: '.', command: ['x'], as: 'haiccing/base-package-help/annotate-answer', error: 'no node there' }), 'k3'))
  t.alike(decodeAnswer(reg, err).value.value, { request: 'data', at: '.', command: ['x'], as: 'haiccing/base-package-help/annotate-answer', error: 'no node there' }, 'an error: no output')
})

test('typed: a component\'s inbox for typed answers, followed beside JSON records', { timeout: 10000 }, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'typed-'))
  try {
    const reg = registry(join(dir, 'schemas'))
    reg.add(JSON.parse(readFileSync(join(here, 'schemas', 'data.json'), 'utf8')))
    const rec = { folder: dir, mrepo: 'local/help', schemas: join(dir, 'schemas') }
    typedBox(rec).write('k1', keyed('/local/help/splectral/inbox', record('/splectral', { request: 'data', at: '.', command: ['info/get'], as: 'pear-full-square/mycelium-value-avro/json', output: { any: 1 } }), 'k1'))
    const got = []
    const f = follow(join(dir, SIDE, 'inbox'), (envelope, file) => got.push([file, envelope.value.value.output]), { every: 100, avro: bytes => decodeAnswer(reg, bytes) })
    f.stop()
    t.alike(got, [['k1.avro', { any: 1 }]], 'the .avro record decoded, as a JSON one is read')
    const plain = []
    follow(join(dir, SIDE, 'inbox'), (e, file) => plain.push(file), { every: 100 }).stop()
    t.alike(plain, [], 'with no decoder: not among them')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
