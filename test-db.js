'use strict'

const test = require('tape')
const DB = require('./db').DB
const Bridge = require('./bridge').Bridge

test('query before add', t => {
  const d1 = new DB()

  d1.replayAfter(0, 'change', (page, delta) => {
    t.equal(page.name, 'Peter')
    t.equal(delta.__target, page)
    t.equal(delta.key, 'name')
    t.equal(delta.value, 'Peter')
    //t.equal(delta.oldValue, undefined)
    t.end()
  })
  d1.add({name: 'Peter'})
})

test('query after add', t => {
  const d1 = new DB()

  d1.add({name: 'Peter'})
  d1.replayAfter(0, 'change', (page, delta) => {
    t.equal(page.name, 'Peter')

    // is it delta.__rawpage or delta.__proxy ?!
    t.equal(delta.__target, page)
    
    t.equal(delta.key, 'name')
    t.equal(delta.value, 'Peter')
    //t.equal(delta.oldValue, undefined)
    t.end()
  })
})

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
