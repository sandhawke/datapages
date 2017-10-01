'use strict'

// factor out test-primative ?

const test = require('tape')
const InMem = require('./inmem').InMem
const Bridge = require('./bridge').Bridge
const StoreCSV = require('./store-csv').StoreCSV
const debug = require('debug')('datapages_test_store')
const fs = require('fs')
const path = require('path')

test('read', t => {
  const db = new StoreCSV('/etc/passwd')
  db.listenSince(0, 'change', (pg, delta) => {
    debug('heard', delta)
  })
  db.on('stable', () => {
    t.end()
  })
})

test.only('using temporary files', tt => {
  fs.mkdtemp('/tmp/datapages-test-', (err, tmp) => {
    if (err) throw err;
    tt.comment('running file tests in: ' + tmp)
    
    tt.test('applyDelta', t => {
      const file = path.join(tmp, 't1')
      const db = new StoreCSV(file)
      db.on('save', delta => {
        t.equal(delta.value, 20)
        const written = fs.readFileSync(file, 'utf8')
        t.equal(written, '1,age,20,,\n')
        t.end()
      })
      db.setProperty(1, 'age', 20)
    })

    tt.test('applyDelta 3', t => {
      const file = path.join(tmp, 't2')
      const db = new StoreCSV(file)
      db.on('save', delta => {
        if (delta.value === 40) {
          const written = fs.readFileSync(file, 'utf8')
          t.equal(written, '1,age,21,,\n2,age,22,,\n1,age,40,,\n')
          t.end()
        }
      })
      db.setProperty(1, 'age', 21)
      db.setProperty(2, 'age', 22)
      db.setProperty(1, 'age', 40)
    })

    tt.test('read deltas', t => {
      const file = path.join(tmp, 'read-deltas')
      const text = '1,age,21,,\n2,age,22,,\n1,age,40,,\n'
      fs.writeFileSync(file, text, 'utf8')
      const db = new StoreCSV(file)
      db.listenSince(0, 'change', (pg, delta) => {
        debug('heard', delta)
      })
      db.on('stable', () => {
        t.end()
      })
    })
  })
})

