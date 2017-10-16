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

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

// test.skip doesn't work on sub-tests, so do this instead.
const runOld = true
const runNew = true
const runToDo = false

function run (test, maker) {
  debug('running')

  if (runOld) test('create-set-listen', async (t) => {
    t.comment('for store type ' + maker.name)
    const db = await maker()
    const created = db.create()
    db.setProperty(created, 'color', 'green')
    t.comment('property set')
    db.listenSince(0, 'change', async (pg, delta) => {
      // BUG t.equal(pg, created)
      // BUG t.equal(delta.subject, created)
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'green')
      t.equal(delta.seq, 1)
      await db.close()
      t.comment('closed')
      t.end()
    })
  })

  if (runOld) test('create-props-listen', async (t) => {
    t.comment('for store type ' + maker.name)
    const db = await maker()
    //  const created = 
    db.create({color: 'green'})
    db.listenSince(0, 'change', async (pg, delta) => {
      // BUG t.equal(pg, created)
      // BUG t.equal(delta.subject, created)
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'green')
      t.equal(delta.seq, 1)
      db.close()
      t.end()
    })
  })

  if (runOld) test('nesting',  async (t) => {
    const db = await maker()
    if (db.materialized) {
      const initial = {a: {b: [{c:5, d:10}, 100, 'hello']}}
      const c = db.create(initial)
      // console.log('c is', c)
      // console.log('c copy is', Object.assign({}, c))
      // console.log('json', JSON.stringify(c))
      // const readout = JSON.parse(JSON.stringify(c))
      const readout = Object.assign({}, c)
      delete readout.__rawseq
      // console.log('readout', readout)
      t.deepEqual(readout, initial)
    }
    db.close()
    t.end()
  })

  // wrapping!
  if (runToDo) test('wrapping results', async (t) => {
    const db = await maker()
    if (db.materialized) {
      const initial = {a: {b: 31}}
      const page = db.create(initial)
      t.ok(page.a.__target)
    }
    db.close()
    t.end()
  })
  
  if (runOld) test('property path', async (t) => {
    const db = await maker()
    if (db.materialized) {
      const initial = {a: {b: {c:5, d:10}}}
      const c = db.create(initial)
      t.equal(c.a, initial.a)
      t.equal(c['a'], initial.a)
      t.equal(c.a.b, initial.a.b)
      t.equal(c['a.b'], initial.a.b)
      t.equal(c.a.b.c, initial.a.b.c)
      // TODO       t.equal(c['a.b.c'], initial.a.b.c)
      // t.equal(c.a['b.c'], initial.a.b.c)
    }
    db.close()
    t.end()
  })

  if (runOld) test('listen-create-set', async (t) => {
    t.comment('for store type ' + maker.name)
    const db = await maker()
    let created
    db.listenSince(0, 'change', (pg, delta) => {
      // BUG: t.equal(pg, created)
      // BUG: t.equal(delta.subject, created)
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'green')
      t.equal(delta.seq, 1)
      db.close()
      t.end()
    })
    created = db.create()
    db.setProperty(created, 'color', 'green')
  })

  if (runOld) test('weird timing on listenSince', async (t) => {
    t.comment('for store type ' + maker.name)
    const db = await maker()
    const events = []
    let created = db.create({weird_color: 'red'})  // needs replay
    db.listenSince(0, 'change', (pg, delta) => {
      // console.log('# heard change %o', delta)
      // BUG: t.equal(pg, created)
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

  if (runOld) test('stable', async (t) => {
    if (maker.name === 'RawClientImmediateServer' ||   // bug
        maker.name.match(/NetworkServer/) || // timing issues
        maker.name.match(/ReadyServer/) // reuse issues
       ) {        // timing issues
      t.end()
      return
    }
    t.comment('for store type ' + maker.name)
    const db = await maker()
    if (!db.emitsStable) {
      t.end()
      return
    }
    const events = []

    let obj = db.create({a: 1})

    db.on('stable', async (stableDB, delta) => {
      t.equal(stableDB, db)
      const d = Object.assign({}, delta)
      // these differ with the different makers
      delete d.subject
      delete d.oldValue
      delete d.who
      delete d.when
      events.push(d)
    })

    db.setProperty(obj, 'a', 2)
    db.setProperty(obj, 'a', 3)
    await sleep(5)
    db.setProperty(obj, 'a', 4)
    db.setProperty(obj, 'a', 5)
    await sleep(10)  // stable here
    db.setProperty(obj, 'a', 6)
    db.setProperty(obj, 'a', 7)
    await sleep(10) // stable here
    db.setProperty(obj, 'a', 8)
    db.setProperty(obj, 'a', 9)
    await sleep(100) // stable here
    t.deepEqual(events, [
      { property: 'a', value: 5, seq: 5 },
      { property: 'a', value: 7, seq: 7 },
      { property: 'a', value: 9, seq: 9 }
    ])
    await db.close()
    t.end()
  })
}

module.exports = run
