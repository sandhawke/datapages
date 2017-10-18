'use strict'

// skip all these tests in browser
if (typeof window === 'undefined') {
  const test = require('tape')
  // const InMem = require('./inmem').InMem
  // const Bridge = require('./bridge').Bridge
  const FlatFile = require('../flatfile')
  const debug = require('debug')('datapages_test_store')
  const fs = require('fs')
  const path = require('path')
  const seedrandom = require('seedrandom')

  test('using temporary files', tt => {
    fs.mkdtemp('/tmp/datapages-test-', (err, tmp) => {
      if (err) throw err
      tt.comment('running file tests in: ' + tmp)

      tt.test('applyDelta', t => {
        const file = path.join(tmp, 't1')
        const db = new FlatFile(file)
        db.on('save', delta => {
          t.equal(delta.value, 20)
          const written = fs.readFileSync(file, 'utf8')
          t.equal(written, 'seq,subject,property,value,who,when\n1,1,age,20,,\n')
          db.close()
          t.end()
        })
        db.setProperty(1, 'age', 20, null, null)
      })

      const text3 = `seq,subject,property,value,who,when
1,1,age,21,,
2,2,age,22,,
3,1,age,40,,
`

      tt.test('applyDelta 3', t => {
        const file = path.join(tmp, 't2')
        const db = new FlatFile(file)
        db.on('save', delta => {
          if (delta.value === 40) {
            const written = fs.readFileSync(file, 'utf8')
            t.equal(written, text3)
            db.close()
            t.end()
          }
        })
        db.setProperty(1, 'age', 21, null, null)
        db.setProperty(2, 'age', 22, null, null)
        db.setProperty(1, 'age', 40, null, null)
      })

      tt.test('read deltas', async (t) => {
        const file = path.join(tmp, 'read-deltas')
        fs.writeFileSync(file, text3, 'utf8')
        const db = new FlatFile(file)
        const deltas = []

        await db.replaySince(0, 'change', (pg, delta) => {
          deltas.push(delta)
          debug('heard', delta)
        })

        t.deepEqual(deltas, [
        { seq: 1, subject: 1, property: 'age', value: 21 },
        { seq: 2, subject: 2, property: 'age', value: 22 },
        { seq: 3, subject: 1, property: 'age', value: 40 }
        ])
        db.close()
        t.end()
      })

      tt.test('hammer 1', hammer.bind(null, 1))
      tt.test('hammer 2', hammer.bind(null, 2))
      tt.test('hammer 3', hammer.bind(null, 3))
      tt.test('hammer 4', hammer.bind(null, 4))
      tt.test('hammer 5', hammer.bind(null, 5))

      function hammer (n, t) {
      // what this really tests is whether, when using the syncronous
      // stack, everything is in deterministic order.  This is how I
      // realized csv-parse wasn't just using a callback, it was
      // calling the callbacks in random order.  But even without that, we
      // still have issues.

        const file = path.join(tmp, 'hammer' + n)
        const db = new FlatFile(file)
        const rng = seedrandom(n)
        let run = true
        setTimeout(() => {
          t.comment('stopping hammer, num deltas=' + db.deltas.size)
          run = false
          db.close()
          check()
        // setTimeout(check, 1000)
        }, 200)

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
              }, rng() * 2)
            }
          })
        }

        runner(1)
        runner(-1)
        runner(2)
        runner(-2)
        db.setProperty(db.create(), 'level', 1000, 0)

        async function check () {
          debug('now checking')
          const db = new FlatFile(file)
          let val = 1000
          await db.replaySince(0, 'change', (pg, delta) => {
            debug('checking: val %d delta %o', val, delta)
            if (delta.value !== val + delta.who) {
              t.comment('bad delta ' + JSON.stringify(delta))
              t.equal(delta.value, val + delta.who)  // will fail
            }
            val = delta.value
          })
          t.pass('deltas did increment in sequence')
          t.comment('test dir was: ' + tmp)
          db.close()
          t.end()
        }
      }
    })
  })
}
