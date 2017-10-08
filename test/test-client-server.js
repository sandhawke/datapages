'use strict'

const test = require('tape')
// const Bridge = require('./bridge').Bridge
// const InMem = require('./inmem').InMem
// const path = require('path')
// const util = require('util')
const Client = require('../client')
const MinDB = require('../mindb')
const Server = require('../server')
const debug = require('debug')('datapages_test_client_server')
const fs = require('fs')
const transport = require('./fake-transport')

const doWebgram = true

function forEachTransport (t, run) {
  t.test('with fake transport', t => {
    const f = new transport.Server()
    const s = new Server({transport: f, db: new MinDB()})
    const c = new Client({transport: f.connectedClient()})
    const c2 = new Client({transport: f.connectedClient()})
    run(t, s, c, c2)
  })

  if (doWebgram) {
    fs.mkdtemp('/tmp/datapages-test-', (err, tmp) => {
      if (err) throw err

      t.test('with webgram', async (t) => {
        const s = new Server({
          serverSecretsDBName: tmp,  // deep in webgram-sessions
          db: new MinDB()})
        await s.transport.start()
        const c = new Client({serverAddress: s.transport.address})
        run(t, s, c)
      })
    })
  }
}

test('delta outbound after', tt => {
  forEachTransport(tt, (t, s, c) => {
    c.listenSince(0, 'change', (pg, delta) => {
      // console.log('XXX', pg, delta)
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'red')
      c.close()
      s.close()
      t.pass()
      t.end()
    })
    const obj = s.db.create()
    debug('id %j', obj)
    s.db.setProperty(obj, 'color', 'red')
  })
})

test('delta outbound before', tt => {
  forEachTransport(tt, (t, s, c) => {
    const obj = s.db.create()
    debug('id %j', obj)
    s.db.setProperty(obj, 'color', 'red')
    c.listenSince(0, 'change', (pg, delta) => {
      // console.log('XXX', pg, delta)
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'red')
      c.close()
      s.close()
      t.pass()
      t.end()
    })
  })
})

test('delta inbound', tt => {
  forEachTransport(tt, (t, s, c) => {
    const obj = c.create()
    debug('id %j', obj)
    c.applyDelta({subject: obj, property: 'color', value: 'red'})
    s.db.listenSince(0, 'change', (pg, delta) => {
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'red')
      c.close()
      s.close()
      t.pass()
      t.end()
    })
  })
})

test('delta inbound before', tt => {
  forEachTransport(tt, (t, s, c, c2) => {
    const obj = c2.create()
    debug('id %j', obj)
    c2.applyDelta({subject: obj, property: 'color', value: 'red'})
    c.listenSince(0, 'change', (pg, delta) => {
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'red')
      c.close()
      s.close()
      t.pass()
      t.end()
    })
  })
})

/*
test.only('transport', tt => {
  forEachTransport(tt, (t, s, c) => {
    c.transport.send('hello', 10, 20, 30)
    t.end()
  })
})
*/
