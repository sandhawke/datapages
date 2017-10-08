'use strict'

const test = require('tape')
// const debug = require('debug')('datapages_test_view')
const datapages = require('..')

test('null filter listen first', t => {
  const db = new datapages.InMem()
  const v = db.view({filter: {}})
  v.listenSince(0, 'change', (pg, delta) => {
    t.equal(pg.color, 'green')
    t.equal(delta.property, 'color')
    t.equal(delta.value, 'green')
  })
  db.create({color: 'green'})
  t.end()
})

test('null filter listen second', t => {
  const db = new datapages.InMem()
  const v = db.view({filter: {}})
  db.create({color: 'green'})
  v.listenSince(0, 'change', (pg, delta) => {
    t.equal(pg.color, 'green')
    t.equal(delta.property, 'color')
    t.equal(delta.value, 'green')
  })
  t.end()
})

test('more simple filter', async (t) => {
  const db = new datapages.InMem()
  const events = []
  const v = db.view({filter: {breed: 'st bernard'}})

  const rover = db.create({name: 'rover'})
  rover.breed = 'collie'

  await v.listenSince(0, 'change', (pg, delta) => {
    delete delta.subject
    events.push([clean(pg), delta])
  })

  t.deepEqual(events, [ ])
  t.end()
})

test('more complex filter', async (t) => {
  const db = new datapages.InMem()
  const events = []
  const v = db.view({filter: {breed: 'collie'}})

  const rover = db.create({name: 'rover'})
  rover.breed = 'collie'   // if we did this during create, order would be non-deterministic
  rover.age = 1

  const spot = db.create({name: 'spot'})
  spot.breed = 'samoyed'
  spot.age = 4

  await v.listenSince(0, 'change', (pg, delta) => {
    delete delta.subject
    events.push([clean(pg), delta])
  })

  rover.age = 2
  rover.age = 3

  t.deepEqual(events, [
    // we get this one because we added the listener after saying it's a collie
    [ { name: 'rover', breed: 'collie', age: 1 }, { property: 'name', oldValue: undefined, value: 'rover', seq: 1 } ],
    [ { name: 'rover', breed: 'collie', age: 1 }, { property: 'breed', oldValue: undefined, value: 'collie', seq: 2 } ],
    [ { name: 'rover', breed: 'collie', age: 1 }, { property: 'age', oldValue: undefined, value: 1, seq: 3 } ],
    [ { name: 'rover', breed: 'collie', age: 2 }, { property: 'age', oldValue: 1, value: 2, seq: 7 } ],
    [ { name: 'rover', breed: 'collie', age: 3 }, { property: 'age', oldValue: 2, value: 3, seq: 8 } ]
  ])
  t.end()
})

// make a static copy, and removed __ properties
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
