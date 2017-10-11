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
const mockDate = require('mockdate')

mockDate.set('2/1/1988',120);
debug('date mocked to', new Date())

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
    debug('buffer() called, %o', delta)
    const d = Object.assign({}, delta)
    delete d.oldValue
    // d.when = d.when.toISOString()
    buff.push([pg, d])
  }

  tt.test('1 delta', async (t) => {
    buff = []
    await c.listenSince(0, 'change', buffer)
    c.off('change', buffer)
    t.deepEqual(buff, [
      [ 1, { seq: 1, subject: 1, property: 'color', value: 'red',
             when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    t.end()
  })

  tt.test('same delta again', async (t) => {
    buff = []
    debug('pre listen buff: %O', buff)
    await c.listenSince(0, 'change', buffer)
    c.off('change', buffer)
    debug('post listen buff: %O', buff)
    t.deepEqual(buff, [
      [ 1, { seq: 1,
        subject: 1,
        property: 'color',
        value: 'red',
        when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    t.end()
  })

  tt.test('now into a proxy', async (t) => {
    buff = []
    await r.listenSince(0, 'change', buffer)
    const subj = buff[0][0]
    t.deepEqual(buff, [
      [ subj, { seq: 1, subject: subj, property: 'color', value: 'red',
             when: new Date('2017-10-09T14:26:07.783Z')} ]
    ])
    t.equal(subj.color, 'red')
    t.end()
  })
  
  tt.test('change via proxy', async (t) => {
    const pup = r.create()
    debug('.')
    debug('.')
    debug('.')
    debug('.')
    pup.color = 'brown'
    setTimeout(() => {
      const text = fs.readFileSync(datafile, 'utf8')
      t.equal(text, `seq,subject,property,value,who,when
1,1,color,"""red""",,2017-10-09T14:26:07.783Z
2,2,color,"""brown""",3,1988-02-01T05:00:00.000Z
`)
      t.end()
    }, 100)
  })
})
