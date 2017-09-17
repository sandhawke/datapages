'use strict'

const test = require('tape')
const datapages = require('.')
const remove = require('remove')

async function start (numberOfClients) {
  const result = []
  // need to make it so we can pass these in better
  // remove.removeSync(__dirname + '/webgram-client-secrets')
  // remove.removeSync(__dirname + '/webgram-server-secrets')
  remove.removeSync(__dirname + '/data.deltas', {ignoreMissiong: true})

  const server = new datapages.Server({db: 'skip'})
  await server.start()

  result.push(server)
  const opts = {serverAddress: server.address, db: 'skip'}
  for (let i = 0; i < numberOfClients; i++) {
    const client = new datapages.DB(opts)
    result.push(client)
  }
  return result
}

async function end (t, s, ...cs) {
  for (let c of cs) {
    c.close()
  }
  await s.stop()
  t.end()
}

test(async (t) => {
  t.plan(1)
  const [s, c1, c2] = await start(2)
  c2.on('changed', page => {
    t.equal(page.name, 'Alice')
    end(t, s, c1, c2)
  })
  c1.add({name: 'Alice'})
})
