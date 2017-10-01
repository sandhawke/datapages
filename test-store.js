'use strict'

// factor out test-primative ?

const test = require('tape')
const InMem = require('./inmem').InMem
const Bridge = require('./bridge').Bridge
const StoreCSV = require('./store-csv').StoreCSV
const debug = require('debug')('datapages_test_store')
const fs = require('fs')
const path = require('path')
const seedrandom = require('seedrandom')

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
        t.equal(written, '1,1,age,20,,\n')
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
          t.equal(written, '1,1,age,21,,\n2,2,age,22,,\n3,1,age,40,,\n')
          t.end()
        }
      })
      db.setProperty(1, 'age', 21)
      db.setProperty(2, 'age', 22)
      db.setProperty(1, 'age', 40)
    })

    tt.test('read deltas', t => {
      const file = path.join(tmp, 'read-deltas')
      const text = '1,1,age,21,,\n2,2,age,22,,\n3,1,age,40,,\n'
      fs.writeFileSync(file, text, 'utf8')
      const db = new StoreCSV(file)
      db.on('stable', () => {
        debug('stable')
        t.end()
      })
      db.listenSince(0, 'change', (pg, delta) => {
        debug('heard', delta)
      })
    })

    tt.test('hammer', t => {
      const file = path.join(tmp, 'hammer')
      const db = new StoreCSV(file)
      const rng = seedrandom(123456789)
      let run = true
      setTimeout(() => {
        t.comment('aborting, num deltas=' + db.deltas.size)
        run = false
        db.close()
        setTimeout(check, 1000)
      }, 10)

      let val
      
      function runner (n) {
        db.on('change', (pg, delta) => {
          val = delta.value
          debug('runner %d got %o', n, delta)
          if (run) {
            setTimeout(() => {
              db.setProperty(pg, 'level', val + n, n)
            }, rng() * 10)
          }
        })
      }

      runner(1)
      runner(-1)
      runner(2)
      runner(-2)
      db.setProperty(db.create(), 'level', 1000, 0)

      function check() {
        debug('now checking')
        const db = new StoreCSV(file)
        db.on('stable', () => {
          debug('stable, done checking')
          t.end()
        })
        let val = 1000
        db.listenSince(0, 'change', (pg, delta) => {
          debug('checking: val %d delta %o', val, delta)
          t.equal(delta.value, val + delta.who)
          val = delta.value
        })
      }
    })
  })
})


