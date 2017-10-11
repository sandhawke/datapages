'use strict'

/*

  Test the full normal stack, in little-ish bits:

  - app
  - inmem proxy
  - bridge
  - rawclient
  - transport
  - server
  - bridge
  - flatfile

  For example, make a delta in the app, and see that it lands in the file.

  Or make a file, and see that the deltas in that file make it to the app.

 */

const test = require('tape')

const datapages = require('..')
const debug = require('debug')('datapages_test_persistent_server')
const fs = require('fs')
const path = require('path')
const transport = require('./fake-transport')

const tmp = fs.mkdtempSync('/tmp/datapages-test-')

test(tt => {
  tt.comment('tempfiles in ' + tmp)

  const f = new transport.Server()
  const datafile = path.join(tmp, 'data.csv')

  fs.writeFileSync(datafile, `seq,subject,property,value,who,when
1,1,color,"""red""",,2017-10-09T14:26:07.783Z
`, 'utf8')
  const s = new datapages.Server({
    transport: f,
    db: new datapages.FlatFile(datafile)
  })
  const c = new datapages.RawClient({transport: f.connectedClient()})
  const c2 = new datapages.RawClient({transport: f.connectedClient()})
  const r = new datapages.Remote({transport: f.connectedClient()})

  debug('connected %o %o %o %o', s, c, c2, r)

  let buff

  const buffer = (pg, delta) => {
    const d = Object.assign({}, delta)
    // d.when = d.when.toISOString()
    buff.push([pg, d])
  }

  /*
  tt.test('1 delta', async (t) => {
    buff = []
    await c.listenSince(0, 'change', buffer)
    t.deepEqual(buff, [
      [ 1, { seq: 1, subject: 1, property: 'color', value: 'red',
             when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    t.end()
  })
  */

  tt.test('same delta again', async (t) => {
    buff = []
    await c.listenSince(0, 'change', buffer)
    t.deepEqual(buff, [
      [ 1, { seq: 1,
        subject: 1,
        property: 'color',
        value: 'red',
        when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    t.end()
  })

    /*
  tt.test('now into a proxy', async (t) => {
    buff = []
    await r.listenSince(0, 'change', buffer)
    t.deepEqual(buff, [
      [ 1, { seq: 1, subject: 1, property: 'color', value: 'red',
             when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    t.end()
  }) */
})
