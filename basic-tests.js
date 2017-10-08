'use strict'

const debug = require('debug')('datapages_basic_tests')

// These are the things that every DB must be able to do
//
// it's called by test.js and browser-test.js with various constructors
// set for 'maker'
//
// TODO: maker(n) returns an array of n interfaces to the same db.
// For InMem, they would just be the same instance.  For
// Client+Server, they'd be two distinct clients on the same server.

function run (test, maker) {
  debug('running')

  test('create-set-listen', async (t) => {
    debug('test 1')
    t.comment('for store type ' + maker.name)
    t.comment('awaiting maker')
    const db = await maker()
    t.comment('maker created db')
    const created = db.create()
    db.setProperty(created, 'color', 'green')
    t.comment('property set')
    db.listenSince(0, 'change', (pg, delta) => {
      t.equal(pg, created)
      t.equal(delta.subject, created)
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'green')
      t.equal(delta.seq, 1)
      db.close()
      t.end()
    })
  })

  test('create-props-listen', async (t) => {
    t.comment('for store type ' + maker.name)
    const db = await maker()
    const created = db.create({color: 'green'})
    db.listenSince(0, 'change', (pg, delta) => {
      t.equal(pg, created)
      t.equal(delta.subject, created)
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'green')
      t.equal(delta.seq, 1)
      db.close()
      t.end()
    })
  })

  test('listen-create-set', async (t) => {
    t.comment('for store type ' + maker.name)
    const db = await maker()
    let created
    db.listenSince(0, 'change', (pg, delta) => {
      t.equal(pg, created)
      t.equal(delta.subject, created)
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'green')
      t.equal(delta.seq, 1)
      db.close()
      t.end()
    })
    created = db.create()
    db.setProperty(created, 'color', 'green')
  })

  test('weird timing on listenSince', async (t) => {
    t.comment('for store type ' + maker.name)
    const db = await maker()
    const events = []
    let created = db.create({weird_color: 'red'})  // needs replay
    db.listenSince(0, 'change', (pg, delta) => {
      // console.log('# heard change %o', delta)
      t.equal(pg, created)
      // simplify comparing results by ignoring these
      delete delta.subject
      delete delta.who
      delete delta.when
      delete delta.oldValue

      // IGNORE unless it's THIS TEST, since the store might
      // have stuff from earier tests still in it.  In browser
      // testing, we have one backend for several tests at the
      // moment.
      delete delta.seq
      if (delta.property !== 'weird_color') return

      events.push(delta)

      if (delta.value === 'blue') {
        t.deepEqual(events, [
          { property: 'weird_color', value: 'red' },
          { property: 'weird_color', value: 'green' },
          { property: 'weird_color', value: 'yellow' },
          { property: 'weird_color', value: 'blue' }
        ])
        db.close()
        t.end()
      }
    })
    db.once('delta', delta => {
      db.setProperty(created, 'weird_color', 'yellow') // during on-change callback
      db.setProperty(created, 'weird_color', 'blue')   // during on-change callback
    })
    db.setProperty(created, 'weird_color', 'green') // normal change-watch
  })
}

module.exports = run
