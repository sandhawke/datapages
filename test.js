'use strict'

const test = require('tape')
const dp = require('.')

test(async (t) => {
  const server = new dp.Server({port: 6001})
  await server.start()
  const c1 = new dp.DB({serverAddress: server.address})
  c1.add({name: 'Alice'})
  t.end()
})
