'use strict'

const test = require('./setup')

const opts = { proxy: true }

test.multi(opts, 'null filter listen first', t => {
  const db = t.db
  const v = db.view({filter: {color: {required: true}}})
  v.listenSince(0, 'change', (pg, delta) => {
    t.equal(pg.color, 'green')
    t.equal(delta.property, 'color')
    t.equal(delta.value, 'green')
    t.end()
  })
  db.create({color: 'green'})
})

test.multi(opts, 'null filter listen second', t => {
  const db = t.db
  const v = db.view({filter: {}})
  db.create({color: 'green'})
  v.listenSince(0, 'change', (pg, delta) => {
    t.equal(pg.color, 'green')
    t.equal(delta.property, 'color')
    t.equal(delta.value, 'green')
  })
  t.end()
})

test.multi(opts, 'more simple filter', async (t) => {
  const db = t.db
  const v = db.view({filter: {breed: 'st bernard'}})

  const rover = db.create({name: 'rover'})
  rover.breed = 'collie'

  await v.listenSince(0, 'change', (pg, delta) => t.logDelta(delta))

  t.deepEqual(t.deltas, [ ])
  t.end()
})

// THIS ONE FAILS in the network setups   Need to make the test better reflect what we
// actual require of the situation.
test.multi(Object.assign({only: 'inmem'}, opts), 'more complex filter', async (t) => {
  const db = t.db
  const v = db.view({filter: {
    breed: 'collie',
    age: {required: true},
    name: {required: true}
  }})

  const rover = db.create({name: 'rover'})
  rover.breed = 'collie'   // if we did this during create, order would be non-deterministic
  rover.age = 1

  const spot = db.create({name: 'spot'})
  spot.breed = 'samoyed'
  spot.age = 4

  await v.listenSince(0, 'change', (pg, delta) => t.logDelta(delta))

  rover.age = 2
  rover.age = 3

  await t.sleep(100)

  t.deepEqual(t.deltas, [
    { subject: { name: 'rover', breed: 'collie', age: 1 }, property: 'name', value: 'rover' },
    { subject: { name: 'rover', breed: 'collie', age: 1 }, property: 'breed', value: 'collie' },
    { subject: { name: 'rover', breed: 'collie', age: 1 }, property: 'age', value: 1 },
    { subject: { name: 'rover', breed: 'collie', age: 2 }, property: 'age', value: 2, oldValue: 1 },
    { subject: { name: 'rover', breed: 'collie', age: 3 }, property: 'age', value: 3, oldValue: 2 }
  ])
  t.end()
})

test.multi(opts, 'iteration', async (t) => {
  const db = t.db
  // const events = []
  const v = db.view({filter: {color: {exists: true}}})
  const objects = [
    db.create({color: 'red'}),
    db.create({color: 'green'}),
    db.create({color: 'blue'})
  ]
  await t.sleep(100)
  const out = Array.from(v)

  t.deepEqual(out, objects)
  db.close()
  t.end()
})
