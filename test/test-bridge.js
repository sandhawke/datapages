'use strict'

const test = require('./setup')

const opts = {proxy: true}

test.multi(opts, 'bridge changes', t => {
  const d1 = t.db
  const d2 = t.unrelatedDB('d2') // new dp.InMem({name: 'd2'})
  d1.bridge(d2)
  // const b = new Bridge(d1, d2)

  // this one runs before the add
  d2.listenSince(0, 'change', (page, delta) => {
    t.equal(page.name, 'Peter')
    // this one runs after the add
    d2.listenSince(0, 'change', (page, delta) => {
      t.equal(page.name, 'Peter')
      // b.stop()
      t.end()
    })
  })

  const pg = d1.create()
  // d1.setProperty(pg, 'name', 'Peter')
  pg.name = 'Peter'
})

test.multi(opts, 'chain of bridges', t => {
  const d1 = t.db
  const d2 = t.unrelatedDB({name: 'd2'})
  const d3 = t.unrelatedDB({name: 'd3'})
  const d4 = t.unrelatedDB({name: 'd4'})
  d1.bridge(d2) // new Bridge(d1, d2) // eslint-disable-line no-new
  d2.bridge(d3) // new Bridge(d2, d3) // eslint-disable-line no-new
  d3.bridge(d4) // new Bridge(d3, d4) // eslint-disable-line no-new
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
