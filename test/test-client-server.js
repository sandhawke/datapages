'use strict'

/*
At some point it would be nice to refactor this with test-basics and
browser tests.

Also, maybe distinguish LowLevel and HighLevel (Proxy) API
*/

const test = require('tape')
// const Bridge = require('./bridge').Bridge
const datapages = require('..')
// const path = require('path')
// const util = require('util')
// const Client = require('../client')
const MinDB = require('../mindb')
const Server = require('../server')
const debug = require('debug')('datapages_test_client_server')
const fs = require('fs')
const path = require('path')
const transport = require('./fake-transport')

const doWebgram = false

function forEachTransport (t, run, makeDB) {
  const tmp = fs.mkdtempSync('/tmp/datapages-test-')
  t.comment(' ... forEachTransport, in tmp ' + tmp)

  if (!makeDB) {
    makeDB = () => new MinDB()
  }

  t.test('. with fake (local) transport', tt => {
    const f = new transport.Server()
    const s = new Server({transport: f, db: makeDB(tmp)})
    const c = new datapages.RawClient({transport: f.connectedClient()})
    const c2 = new datapages.RawClient({transport: f.connectedClient()})
    run(tt, s, c, c2)
  })

  /*
  t.test('. with fake transport to FlatFile', tt => {
    const f = new transport.Server()
    tt.datafile = path.join(tmp, 'data.csv')
    fs.writeFileSync(tt.datafile, `seq,subject,property,value,who,when
1,1,color,"""red""",,2017-10-09T14:26:07.783Z
`, 'utf8')
    const s = new Server({
      transport: f,
      db: new datapages.FlatFile(tt.datafile)
    })
    const c = new datapages.RawClient({transport: f.connectedClient()})
    const c2 = new datapages.RawClient({transport: f.connectedClient()})
    run(tt, s, c, c2)
  })
*/

  if (doWebgram) {
    t.test(' . with webgram', async (tt) => {
      const secrets = path.join(tmp, 'server-secrets')
      // console.log('XXX', secrets)
      const s = new Server({
        sessionOptions: { serverSecretsDBName: secrets },
        db: makeDB(tmp)})
      await s.transport.start()
      const c = new datapages.RawClient({serverAddress: s.transport.address})
      const c2 = new datapages.RawClient({serverAddress: s.transport.address})
      run(tt, s, c, c2)
    })
  }
}

test('delta outbound after', tt => {
  forEachTransport(tt, (t, s, c) => {
    c.listenSince(0, 'change', (pg, delta) => {
      // console.log(95000, pg, delta)
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'red')
      c.close()
      s.close()
      t.pass()
      t.end()
      // process.exit()
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

test('bridge', tt => {
  forEachTransport(tt, (t, s, c, c2) => {
    const db = new datapages.InMem()
    db.bridge(c)
    // c.bridge(db)
    const obj = c2.create()
    debug('id %j', obj)
    c2.applyDelta({subject: obj, property: 'color', value: 'red'})
    db.listenSince(0, 'change', (pg, delta) => {
      t.equal(delta.property, 'color')
      t.equal(delta.value, 'red')
      db.close()
      c.close()
      s.close()
      t.pass()
      t.end()
    })
  })
})

/*
test('chain', t => {
  fs.mkdtemp('/tmp/datapages-test-', (err, tmp) => {
    if (err) throw err

    const s = new Server({
      serverSecretsDBName: tmp,
      db: new datapages.FlatFile()}) // flatfile
    s.transport.start().then(() => {
      const c = new datapages.Remote({serverAddress: s.transport.address})
      const c2 = new datapages.Remote({serverAddress: s.transport.address})
      run(t, s, c, c2)
    })
  })

  const run = (t, s, c, c2) => {

  }
})
*/

const makeSampleDB = (tmp) => {
  const datafile = path.join(tmp, 'data.csv')
  fs.writeFileSync(datafile, `seq,subject,property,value,who,when
1,1,color,"""red""",,2017-10-09T14:26:07.783Z
`, 'utf8')
  return new datapages.FlatFile(datafile)
}

const getEvents = async (db) => {
  const buff = []
  const buffer = (pg, delta) => {
    debug('buffer() called, %o', delta)
    const d = Object.assign({}, delta)
    delete d.oldValue
    // d.when = d.when.toISOString()
    buff.push([pg, d])
  }

  await db.listenSince(0, 'change', buffer)

  // listenSince over the network doesn't handle this right?!
  await sleep(100)

  db.off('change', buffer)
  return buff
}

test('1 delta', tt => {
  const f = async (t, s, c, c2) => {
    const buff = await getEvents(c)
    t.deepEqual(buff, [
      [ 1, { seq: 1,
        subject: 1,
        property: 'color',
        value: 'red',
        when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    t.end()
  }
  forEachTransport(tt, f, makeSampleDB)
})

test('1 delta again', tt => {
  const f = async (t, s, c, c2) => {
    const buff = await getEvents(c)
    t.deepEqual(buff, [
      [ 1, { seq: 1,
        subject: 1,
        property: 'color',
        value: 'red',
        when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    t.end()
  }
  forEachTransport(tt, f, makeSampleDB)
})

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
