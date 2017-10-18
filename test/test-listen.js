'use strict'

const test = require('./setup')

test.multi('create-set-listen', t => {
  const created = t.db.create()
  t.db.setProperty(created, 'color', 'green')
  t.db.listenSince(0, 'change', async (pg, delta) => {
    // BUG t.equal(pg, created)
    // BUG t.equal(delta.subject, created)
    t.equal(delta.property, 'color')
    t.equal(delta.value, 'green')
    t.equal(delta.seq, 1)
    t.end()
  })
})

test.multi.skip('create-listen-set', t => {
  const created = t.db.create()
  t.db.listenSince(0, 'change', async (pg, delta) => {
    // BUG t.equal(pg, created)
    // BUG t.equal(delta.subject, created)
    t.equal(delta.property, 'color')
    t.equal(delta.value, 'green')
    t.equal(delta.seq, 1)
    t.end()
  })
  t.db.setProperty(created, 'color', 'green')
})
