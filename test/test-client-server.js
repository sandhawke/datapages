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
const atEnd = require('tape-end-hook')
const mockDate = require('mockdate')

mockDate.set('2/1/1988', 120)
debug('date mocked to', new Date())

const doWebgram = true

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function forEachTransport (t, run, makeDB) {
  const tmp = fs.mkdtempSync('/tmp/datapages-test-')
  t.comment(' ... forEachTransport, in tmp ' + tmp)

  if (!makeDB) {
    makeDB = () => new MinDB()
  }

  t.test('. with fake (local) transport', async (tt) => {
    const f = new transport.Server()
    const s = new Server({transport: f, db: makeDB(tmp)})
    const c = new datapages.RawClient({transport: f.connectedClient()})
    const c2 = new datapages.RawClient({transport: f.connectedClient()})
    const r = new datapages.Remote({transport: f.connectedClient()})
    atEnd(tt, () => {
      return Promise.all([
        r.close(),
        c.close(),
        c2.close(),
        s.close()
      ])
    })
    run(tt, s, c, c2, r)
  })

  if (doWebgram) {
    t.test(' . with webgram', async (tt) => {
      const secrets = path.join(tmp, 'server-secrets')
      // console.log('XXX', secrets)
      const s = new Server({
        sessionOptions: { serverSecretsDBName: secrets },
        db: makeDB(tmp)})
      await s.transport.start()
      const options = {
        serverAddress: s.transport.address,
        skipResume: true // otherwise we might reuse auth for old test server on same port
      }
      const c = new datapages.RawClient(options)
      const c2 = new datapages.RawClient(options)
      const r = new datapages.Remote(options)
      atEnd(tt, () => {
        return Promise.all([
          r.close(),
          c.close(),
          c2.close(),
          s.close()
        ])
      })
      run(tt, s, c, c2, r)
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

let datafile
const makeSampleDB = (tmp) => {
  datafile = path.join(tmp, 'data.csv')
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

  // listenSince over the network BUG : resolves too early.
  await sleep(100)

  db.off('change', buffer)
  return buff
}

test('1 delta', tt => {
  const f = async (t, s, c, c2) => {
    const buff = await getEvents(c)
    debug('got buff %O', buff)
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

test('into a proxy', tt => {
  const f = async (t, s, c, c2, r) => {
    const buff = await getEvents(r)
    const subj = buff[0][0]
    t.equal(subj.color, 'red')
    t.deepEqual(buff, [
      [ subj, { seq: 1,
        subject: subj,
        property: 'color',
        value: 'red',
        when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    t.end()
  }
  forEachTransport(tt, f, makeSampleDB)
})

test('change via proxy', tt => {
  const f = async (t, s, c, c2, r) => {
    const pup = r.create()
    pup.color = 'brown'
    await getEvents(r)
    /*  -- not quite working --
    const buff = await getEvents(r)
    const s2 = buff[0][0]
    const s1 = buff[1][0]
    t.deepEqual(buff, [
      [ s1, { seq: 1,
        subject: s1,
        property: 'color',
        value: 'red' } ], // hasn't hit server yet at this point
      [ s2, { seq: 1, // BUG: why is this **ONE** ?!
        subject: s2,
        property: 'color',
        value: 'brown',
        when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    */
    debug('r.rawClient %O', r.rawClient.transport.sessionData)
    const id = r.rawClient.transport.sessionData.id
    setTimeout(() => {
      const text = fs.readFileSync(datafile, 'utf8')
      t.equal(text, `seq,subject,property,value,who,when
1,1,color,"""red""",,2017-10-09T14:26:07.783Z
2,2,color,"""brown""",${id},1988-02-01T05:00:00.000Z
`)
      t.end()
    }, 100)
    /*
    t.deepEqual(buff, [
      [ 1, { seq: 1,
             subject: 1,
             property: 'color',
             value: 'red',
             when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    t.end() */
  }
  forEachTransport(tt, f, makeSampleDB)
})
