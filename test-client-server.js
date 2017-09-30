'use strict'

const test = require('tape')
const InMem = require('./inmem').InMem
const Bridge = require('./bridge').Bridge
const Client = require('./client').Client
const Server = require('./server').Server
const transport = require('./fake-transport')
const util = require('util')
const debug = require('debug')('datapages_test_client_server')

function forEachTransport (t, run) {
  t.test('with fake transport', t => {
    const f = new transport.Server()
    const s = new Server({transport: f})
    const c = new Client({transport: f.connectedClient()})
    run(t, s, c)
  })
  
  t.test('with webgram', async (t) => {
    const s = new Server()
    await s.transport.start()
    const c = new Client({serverAddress: s.transport.address})
    run(t, s, c)
  })
}

test('create client->server', tt => {
  forEachTransport(tt, (t, s, c) => {
    c.transport.on('create-ok', () => {
      c.close()
      s.close()
      t.pass()
      t.end()
    })
    
    c.create()
  })
})

