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
        t.equal(written, '1,1,"age","20",,\n')
        t.end()
      })
      db.setProperty(1, 'age', 20, null, null)
    })

    tt.test('applyDelta 3', t => {
      const file = path.join(tmp, 't2')
      const db = new StoreCSV(file)
      db.on('save', delta => {
        if (delta.value === 40) {
          const written = fs.readFileSync(file, 'utf8')
          t.equal(written, '1,1,"age","21",,\n2,2,"age","22",,\n3,1,"age","40",,\n')
          t.end()
        }
      })
      db.setProperty(1, 'age', 21, null, null)
      db.setProperty(2, 'age', 22, null, null)
      db.setProperty(1, 'age', 40, null, null)
    })

    tt.test('read deltas', t => {
      const file = path.join(tmp, 'read-deltas')
      const text = '1,1,"age","21",,\n2,2,"age","22",,\n3,1,"age","40",,\n'
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
      // this fails, for instance, if sometimes delta are written to the file
      // out of order, as they sometimes are wtf?
      
      const file = path.join(tmp, 'hammer')
      const db = new StoreCSV(file)
      const rng = seedrandom(123456789)
      let run = true
      setTimeout(() => {
        t.comment('stopping hammer, num deltas=' + db.deltas.size)
        run = false
        db.close()
        check()
        // setTimeout(check, 1000)
      }, 50)

      let val
      
      function runner (n) {
        db.on('change', (pg, delta) => {
          val = delta.value
          debug('runner %d got %o', n, delta)
          if (run) {
            setTimeout(() => {
              // this should SYNCRONOUSLY real val, then write the new value,
              // which the next runner will pick up and store into val.
              if (run) db.setProperty(pg, 'level', val + n, n)
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
          t.pass('deltas did increment in sequence')
          t.end()
        })
        let val = 1000
        db.listenSince(0, 'change', (pg, delta) => {
          debug('checking: val %d delta %o', val, delta)
          if (delta.value !== val + delta.who) {
            t.comment('bad delta ' + JSON.stringify(delta))
            t.equal(delta.value, val + delta.who)  // will fail
          }
          val = delta.value
        })
      }
    })
  })
})


