'use strict'

// These are the things that every DB must be able to do
//
// it's called by test.js and browser-test.js with various constructors
// set for 'maker'
//
// TODO: maker(n) returns an array of n interfaces to the same db.
// For InMem, they would just be the same instance.  For
// Client+Server, they'd be two distinct clients on the same server.

function run (test, maker) {
  
  test('create-set-listen', async (t) => {
    t.comment('for store type ' + maker.name)
    const db = await maker()
    const created = db.create()
    db.setProperty(created, 'color', 'green')
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
    let created = db.create({color: 'red'})  // needs replay
    db.listenSince(0, 'change', (pg, delta) => {
      // console.log('# heard change %o', delta)
      t.equal(pg, created)
      // simplify comparing results by ignoring these
      delete delta.subject
      delete delta.who
      delete delta.when
      delete delta.oldValue
      events.push(delta)

      if (delta.value === 'blue') {
        t.deepEqual(events, [
          { property: 'color', value: 'red', seq: 1 },
          { property: 'color', value: 'green', seq: 2 },
          { property: 'color', value: 'yellow', seq: 3 },
          { property: 'color', value: 'blue', seq: 4 }
        ])
        db.close()
        t.end()
      }
    })
    db.once('delta', delta => {
      db.setProperty(created, 'color', 'yellow') // during on-change callback
      db.setProperty(created, 'color', 'blue')   // during on-change callback
    })
    db.setProperty(created, 'color', 'green') // normal change-watch
  })
}

module.exports = run
