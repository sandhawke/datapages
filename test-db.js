'use strict'

const test = require('tape')
const InMem = require('./inmem').InMem
const Bridge = require('./bridge').Bridge
const util = require('util')
// const debug = require('debug')('datapages_test')

test('debugging labels', t => {
  const d1 = new InMem({name: 'd1'})
  t.equal(util.inspect(d1), 'InMem(d1)')

  const pg = d1.create()
  t.equal(util.inspect(pg), 'Proxy_d1_1')

  // d1.setProperty(pg, 'name', 'Peter')

  t.end()
})

test('query before add', t => {
  const d1 = new InMem()

  d1.listenSince(0, 'change', (page, delta) => {
    t.equal(page.name, 'Peter')
    t.equal(delta.subject, page)
    t.equal(delta.property, 'name')
    t.equal(delta.value, 'Peter')
    t.equal(delta.oldValue, undefined)
    t.end()
  })
  d1.create({name: 'Peter'})
})

test('query after add', t => {
  const d1 = new InMem()

  d1.create({name: 'Peter'})
  d1.listenSince(0, 'change', (page, delta) => {
    t.equal(page.name, 'Peter')
    t.equal(delta.subject, page)
    t.equal(delta.property, 'name')
    t.equal(delta.value, 'Peter')
    t.equal(delta.oldValue, undefined)
    t.end()
  })
})

// clean() makes a static copy, and removed __ properties
function clean (obj) {
  if (!obj) return obj
  if (typeof obj !== 'object') return obj
  const result = {}
  for (const key of Object.keys(obj)) {
    if (key.startsWith('__')) continue
    result[key] = clean(obj[key])
  }
  return result
}

test('add property', t => {
  const d1 = new InMem()

  const events = []
  d1.listenSince(0, 'change', (pg, delta) => {
    events.push(clean(delta))
  })
  const pg = d1.create({name: 'Peter'})
  pg.age = 151
  pg.age = 152
  pg.age = undefined
  t.deepEqual(events, [
    { subject: { name: 'Peter' },
      property: 'name',
      oldValue: undefined,
      value: 'Peter',
      seq: 1 },
    { subject: { name: 'Peter', age: 151 },
      property: 'age',
      oldValue: undefined,
      value: 151,
      seq: 2 },
    { subject: { name: 'Peter', age: 152 },
      property: 'age',
      oldValue: 151,
      value: 152,
      seq: 3 },
    { subject: { name: 'Peter' },
      property: 'age',
      oldValue: 152,
      value: undefined,
      seq: 4 } ]
             )
  t.end()
})

test('on-change for object', t => {
  const d1 = new InMem()

  const events = []
  d1.once('change', (pg, delta) => {
    events.push(clean(delta))
    pg.on('change', (pg2, delta) => {
      t.equal(pg, pg2)
      events.push(clean(delta))
    })
  })

  const pg = d1.create({name: 'Peter'})
  pg.age = 151
  pg.age = 152
  pg.age = 153
  t.deepEqual(events, [
    { subject: { name: 'Peter' },
      property: 'name',
      oldValue: undefined,
      value: 'Peter',
      seq: 1 },
    { subject: { name: 'Peter' },
      property: 'name',
      oldValue:
      undefined,
      value: 'Peter',
      seq: 1 },
    { subject: { name: 'Peter', age: 151 },
      property: 'age',
      oldValue: undefined,
      value: 151,
      seq: 2 },
    { subject: { name: 'Peter', age: 152 },
      property: 'age',
      oldValue: 151,
      value: 152,
      seq: 3 },
    { subject: { name: 'Peter', age: 153 },
      property: 'age',
      oldValue: 152,
      value:
      153,
      seq: 4 }
  ])
  t.end()
})

test('bridge changes', t => {
  const d1 = new InMem({name: 'd1'})
  const d2 = new InMem({name: 'd2'})
  const b = new Bridge(d1, d2)

  // this one runs before the add
  d2.listenSince(0, 'change', (page, delta) => {
    t.equal(page.name, 'Peter')
    // this one runs after the add
    d2.listenSince(0, 'change', (page, delta) => {
      t.equal(page.name, 'Peter')
      b.stop()
      t.end()
    })
  })

  const pg = d1.create()
  // d1.setProperty(pg, 'name', 'Peter')
  pg.name = 'Peter'
})

test('chain of bridges', t => {
  const d1 = new InMem({name: 'd1'})
  const d2 = new InMem({name: 'd2'})
  const d3 = new InMem({name: 'd3'})
  const d4 = new InMem({name: 'd4'})
  new Bridge(d1, d2)
  new Bridge(d2, d3)
  new Bridge(d3, d4)
  // new Bridge(d1, d3) // no cycles allowed!!

  // this one runs before the add
  d1.listenSince(0, 'change', (page, delta) => {
    t.equal(page.name, 'Peter')
    // this one runs after the add
    d4.listenSince(0, 'change', (page, delta) => {
      t.equal(page.name, 'Peter')
      t.end()
    })
  })

  const pg = d1.create()
  // d1.setProperty(pg, 'name', 'Peter')
  pg.name = 'Peter'
})