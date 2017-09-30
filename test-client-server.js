'use strict'

const test = require('tape')
const InMem = require('./inmem').InMem
const Bridge = require('./bridge').Bridge
const Client = require('./client').Client
const Server = require('./server').Server
const transport = require('./fake-transport')
const util = require('util')
const debug = require('debug')('datapages_test_client_server')

/*
test('debugging labels', t => {
  const d1 = new InMem({name: 'd1'})
  t.equal(util.inspect(d1), 'InMem(d1)')

  const pg = d1.create()
  t.equal(util.inspect(pg), 'Proxy_d1_1')

  // d1.setProperty(pg, 'name', 'Peter')

  t.end()
})
*/

test('create client->server', t => {
  const f = new transport.Server()
  const s = new Server({transport: f})
  const c = new Client({transport: f.connectedClient()})

  c.create()
})
