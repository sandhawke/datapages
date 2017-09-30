'use strict'

const test = require('tape')
const InMem = require('./inmem').InMem
const Bridge = require('./bridge').Bridge
const StoreCSV = require('./store-csv').StoreCSV
const debug = require('debug')('datapages_test_store')

test('read', t => {
  const db = new StoreCSV('/etc/passwd')
  db.listenSince(0, 'change', (pg, delta) => {
    debug('heard', delta)
  })
  db.on('stable', () => {
    t.end()
  })
})

test.only('setProperty', t => {
  const db = new StoreCSV('/tmp/t1')
  db.setProperty(1, 'age', 20)
})

