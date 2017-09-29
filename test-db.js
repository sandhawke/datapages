'use strict'

const test = require('tape')
const DB = require('./db').DB
const Bridge = require('./bridge').Bridge

test('query before add', t => {
  const d1 = new DB()

  d1.replayAfter(0, 'change', (page, delta) => {
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
  const d1 = new DB()

  d1.create({name: 'Peter'})
  d1.replayAfter(0, 'change', (page, delta) => {
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

test('add property',t => {
  const d1 = new DB()

  const events = []
  d1.replayAfter(0, 'change', (pg, delta) => {
    events.push(clean(delta))
  })
  const pg = d1.create({name: 'Peter'})
  pg.age = 151
  pg.age = 152
  pg.age = undefined
  t.deepEqual(events, [
    { subject: { name: 'Peter' }, property: 'name',
      oldValue: undefined, value: 'Peter', seq: 1 },
    { subject: { name: 'Peter', age: 151 }, property: 'age',
      oldValue: undefined, value: 151, seq: 2 },
    { subject: { name: 'Peter', age: 152 }, property: 'age',
      oldValue: 151, value: 152, seq: 3 },
    { subject: { name: 'Peter' }, property: 'age',
      oldValue: 152, value: undefined, seq: 4 } ]
             )
  t.end()
})


     
/*
test.only('bridge changes', t => {
  const d1 = new DB()
  const d2 = new DB()
  const b = new Bridge(d1, d2)

  // this one runs before the add
  d2.replayAfter(0, 'change', (page, delta) => {
    console.log('XXXXXXXX')
    t.equal(page.name, 'Peter')
    // this one runs after the add
    d2.replayAfter(0, 'change', (page, delta) => {
      t.equal(page.name, 'Peter')
      t.end()
    })
  })
  d1.add({name: 'Peter'})

  t.end()
})
*/
