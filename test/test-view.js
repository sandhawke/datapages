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
  const events = []
  const v = db.view({filter: {breed: 'st bernard'}})

  const rover = db.create({name: 'rover'})
  rover.breed = 'collie'

  await v.listenSince(0, 'change', (pg, delta) => {
    delete delta.subject
    events.push(clean(pg, delta))
  })

  t.deepEqual(events, [ ])
  t.end()
})

// THIS ONE FAILS in the network setups   Need to make the test better reflect what we
// actual require of the situation.
test.multi(Object.assign({only: 'inmem'}, opts), 'more complex filter', async (t) => {
  const db = t.db
  const events = []
  const v = db.view({filter: {breed: 'collie', age: {required: true}, name: {required: true}}})

  const rover = db.create({name: 'rover'})
  rover.breed = 'collie'   // if we did this during create, order would be non-deterministic
  rover.age = 1

  const spot = db.create({name: 'spot'})
  spot.breed = 'samoyed'
  spot.age = 4

  await v.listenSince(0, 'change', (pg, delta) => {
    delete delta.subject
    events.push(clean(pg, delta))
  })

  rover.age = 2
  rover.age = 3

  await t.sleep(100)

  t.deepEqual(events, [
    // we get this one because we added the listener after saying it's a collie
    [ { name: 'rover', breed: 'collie', age: 1 }, { property: 'name', oldValue: undefined, value: 'rover' } ],
    [ { name: 'rover', breed: 'collie', age: 1 }, { property: 'breed', oldValue: undefined, value: 'collie' } ],
    [ { name: 'rover', breed: 'collie', age: 1 }, { property: 'age', oldValue: undefined, value: 1 } ],
    [ { name: 'rover', breed: 'collie', age: 2 }, { property: 'age', oldValue: 1, value: 2 } ],
    [ { name: 'rover', breed: 'collie', age: 3 }, { property: 'age', oldValue: 2, value: 3 } ]
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

// make a static copy, and remove __ properties, and some other stuff
function clean (obj, delta) {
  delete delta.when
  delete delta.who
  delete delta.seq
  if (!obj) return [obj, delta]
  if (typeof obj !== 'object') return [obj, delta]
  const result = {}
  for (const key of Object.keys(obj)) {
    if (key.startsWith('__')) continue
    if (key === '_owner') continue
    result[key] = obj[key]
  }
  return [result, delta]
}
