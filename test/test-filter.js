'use strict'

const test = require('tape')
const { Filter } = require('../filter')

test(t => {
  const f = new Filter({a: 10})
  t.ok(f.passes({a: 10}))
  t.ok(f.passes({a: 10, b: 10}))
  t.notOk(f.passes({a: 11}))
  t.end()
})

test(t => {
  const f = new Filter({a: {'=': 10}})
  t.ok(f.passes({a: 10}))
  t.ok(f.passes({a: 10, b: 10}))
  t.notOk(f.passes({a: 11}))
  t.end()
})

test(t => {
  const f = new Filter({a: {eq: 10}})
  t.ok(f.passes({a: 10}))
  t.ok(f.passes({a: 10, b: 10}))
  t.notOk(f.passes({a: 11}))
  t.end()
})

test(t => {
  const f = new Filter({a: {ge: 10}})
  t.ok(f.passes({a: 10}))
  t.ok(f.passes({a: 11}))
  t.notOk(f.passes({a: 9}))
  t.end()
})

test('value in array', t => {
  const f = new Filter({a: {in: [3, 5, 6]}})
  t.ok(f.passes({a: 3}))
  t.ok(f.passes({a: 5}))
  t.ok(f.passes({a: 6}))
  t.notOk(f.passes({a: 2}))
  t.notOk(f.passes({a: 4}))
  t.notOk(f.passes({a: 7}))
  t.end()
})

test('value in Set', t => {
  const f = new Filter({a: {in: new Set([3, 5, 6])}})
  t.ok(f.passes({a: 3}))
  t.ok(f.passes({a: 5}))
  t.ok(f.passes({a: 6}))
  t.notOk(f.passes({a: 2}))
  t.notOk(f.passes({a: 4}))
  t.notOk(f.passes({a: 7}))
  t.end()
})

test(t => {
  const f = new Filter({a: {includes: 10}})
  t.ok(f.passes({a: [10]}))
  t.ok(f.passes({a: [10, 11]}))
  t.notOk(f.passes({a: 2}))
  t.notOk(f.passes({a: [9]}))
  t.end()
})

test(t => {
  const f = new Filter({a: {type: 'string'}})
  t.ok(f.passes({a: 'hello'}))
  t.ok(f.passes({a: ''}))
  t.notOk(f.passes({a: 2}))
  t.notOk(f.passes({a: true}))
  t.notOk(f.passes({a: new Date()}))
  t.end()
})

test(t => {
  const f = new Filter({a: {type: 'date'}})
  t.ok(f.passes({a: new Date()}))
  t.notOk(f.passes({a: 2}))
  t.notOk(f.passes({a: true}))
  t.notOk(f.passes({a: 'hello'}))
  t.end()
})
