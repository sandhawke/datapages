'use strict'

const test = require('tape')
const refs = require('../refs')

test('refs', t => {
  let id = 0
  function create () {
    return ++id
  }
  function overlay () {}

  const r = refs(create, overlay)
  t.equal(r.from(r.to('hello')), 'hello')

  const x = { mine: true }
  t.deepEqual(r.to(x), {ref: 1})
  t.equal(r.from(r.to(x)), x)
  t.equal(r.from(r.to(x)), x)

  const y = { alsomine: true }
  t.deepEqual(r.to(y), {ref: 2})
  t.equal(r.from(r.to(y)), y)

  const z = [1, 'hello', [2, {a: 100}], {b: {c: [1, {d: 200}]}}]
  t.deepEqual(r.to(z), [ 1, 'hello', [ 2, { ref: 3 } ], { ref: 4 } ])
  t.deepEqual(r.from(r.to(z)), z)

  t.end()
})
