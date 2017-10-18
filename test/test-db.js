'use strict'

const test = require('./setup')

const opts = {proxy: true}
const optsNoWS = Object.assign({ws: false}, opts)

test.multi(opts, 'query before add', t => {
  const d1 = t.db

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

test.multi(opts, 'query after add', t => {
  const d1 = t.db

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

// Fails over ws because we're getting additional events bouncing back
test.multi(optsNoWS, 'add property', async (t) => {
  const d1 = t.db

  // the "await" here is important, we'll be in replay mode
  // as we process, and the first checks will fail.  The second
  // ones would succeed, except the state of the page would be out
  // of sync.
  await d1.listenSince(0, 'change', async (pg, delta) => {
    t.debug('seeing change %o', delta)
    t.logDelta(delta)
  })
  t.comment('listenSince returned')
  const pg = d1.create({name: 'Peter'})
  pg.age = 151
  pg.age = 152
  pg.age = undefined
  const check = () => {
    t.comment('checking values')
    t.deepEqual(t.deltas, [
      { subject: { name: 'Peter' },
        property: 'name',
        value: 'Peter' },
      { subject: { name: 'Peter', age: 151 },
        property: 'age',
        value: 151 },
      { subject: { name: 'Peter', age: 152 },
        property: 'age',
        oldValue: 151,
        value: 152 },
      { subject: { name: 'Peter' },
        property: 'age',
        oldValue: 152,
        value: undefined }
    ])
  }
  // let some async stuff complete
  await t.sleep(100)
  check()
  t.end()
})

test.multi(optsNoWS, 'on-change for object', async (t) => {
  const d1 = t.db

  d1.once('change', (pg, delta) => {
    t.logDelta(delta)
    pg.on('change', (pg2, delta) => {
      t.equal(pg, pg2)
      t.logDelta(delta)
    })
  })

  const pg = d1.create({name: 'Peter'})
  pg.age = 151
  pg.age = 152
  pg.age = 153
  await t.sleep(100)
  t.deepEqual(t.deltas, [
    { subject: { name: 'Peter' },
      property: 'name',
      value: 'Peter'},
    { subject: { name: 'Peter' },
      property: 'name',
      value: 'Peter'},
    { subject: { name: 'Peter', age: 151 },
      property: 'age',
      value: 151},
    { subject: { name: 'Peter', age: 152 },
      property: 'age',
      oldValue: 151,
      value: 152},
    { subject: { name: 'Peter', age: 153 },
      property: 'age',
      oldValue: 152,
      value: 153}
  ])
  t.end()
})
