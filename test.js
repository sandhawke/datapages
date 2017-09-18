'use strict'

const test = require('tape')
const datapages = require('.')
const remove = require('remove')
const path = require('path')

async function start (numberOfClients) {
  const result = []
  // need to make it so we can pass these in better
  // remove.removeSync(__dirname + '/webgram-client-secrets')
  // remove.removeSync(__dirname + '/webgram-server-secrets')
  remove.removeSync(path.join(__dirname,
                              '/data.deltas'), {ignoreMissiong: true})

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

test('simple propagation between clients', async (t) => {
  t.plan(1)
  const [s, c1, c2] = await start(2)
  c2.on('changed', page => {
    t.equal(page.name, 'Alice')
    end(t, s, c1, c2)
  })
  c1.add({name: 'Alice'})
})

test.only('circular structures move between clients', async (t) => {
  // standalone version of this in examples/add-loop
  t.plan(5)
  const [s, c1, c2] = await start(2)
  c2.on('changed', page => {
    if (page.thisIsAubrey) {
      t.equal(page.name, 'Aubrey')
      t.equal(page.age, 15)
      t.equal(page.sister.name, 'Cassia')
      t.equal(page.sister.age, 13)
      t.equal(page.sister.sister, page)
      end(t, s, c1, c2)
    }
  })

  const aubrey = {}
  const cassia = {}

  aubrey.name = 'Aubrey'
  aubrey.age = 15
  aubrey.sister = cassia

  cassia.name = 'Cassia'
  cassia.age = 13
  cassia.sister = aubrey

  c1.add(aubrey)  // adds cassia because it has to

  // flag that it's time for c2 to check what it has
  c1.overlay(aubrey, {thisIsAubrey: true})
})
