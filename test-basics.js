'use strict'

const test = require('tape')
const datapages = require('.')
const fs = require('fs')
const path = require('path')
const transport = require('./fake-transport')
const runTests = require('./basic-tests')

const makers = [
  MinDB,
  InMem,
  FlatFile,
  ClientImmediateServer,
  ClientNetworkServer
]

const tmp = fs.mkdtempSync('/tmp/datapages-test-')
let count = 0
const file = suffix => {
  const result = path.join(tmp, suffix + '_' + ++count)
  console.log('# tmp file', result)
  return result
}

function FlatFile () {
  const filename = file('flat')
  return new datapages.FlatFile(filename)
}

async function MinDB () {
  return new datapages.MinDB()
}

async function InMem () {
  return new datapages.InMem()
}

async function ClientImmediateServer () {
  const f = new transport.Server()
  const s = new datapages.Server({transport: f, db: new datapages.MinDB()})
  s.transport.start()
  const c = new datapages.Client({transport: f.connectedClient()})
  return c
}

async function ClientNetworkServer () {
  const s = new datapages.Server({
    sessionOptions: {
      serverSecretsDBName: file('serversecret')
    },
    db: new datapages.MinDB()})
  await s.transport.start()
  const c = new datapages.Client({serverAddress: s.transport.address})
  const close = c.close.bind(c)
  c.close = () => {
    close()
    s.close()
  }
  return c
}

for (const maker of makers) runTests(test, maker)

/*
const test = require('tape')
const datapages = require('.')
const path = require('path')
const fs = require('fs-extra')

let runCount = 0

async function start (numberOfClients) {
  const result = []

  const root = path.join(__dirname, `/test/run/${++runCount}`)
  const deltasDBName = path.join(root, '/deltas')
  const serverSecretsDBName = path.join(root, '/server-secrets')
  const clientSecretsDBName = (n) => path.join(root, `/client_${n}_secrets`)

  await fs.emptyDir(root)
  process.chdir(root)
  console.log('\n\n\nStartup in', process.cwd())

  const server = new datapages.Server({deltasDBName, serverSecretsDBName})
  await server.start()

  result.push(server)

  for (let i = 0; i < numberOfClients; i++) {
    const opts = {serverAddress: server.address,
      clientSecretsDBName: clientSecretsDBName(i)}
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

// lock problems -- can't test both at once
test.only('simple propagation between clients', async (t) => {
  // t.plan(1)
  const [s, c1, c2] = await start(2)
  c2.on('changed', page => {
    t.equal(page.name, 'Alice')
    end(t, s, c1, c2)
  })
  c1.add({name: 'Alice'})
})

test('circular structures move between clients', async (t) => {
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
  cassia.selves = [cassia]

  c1.add(aubrey)  // adds cassia because it has to

  // flag that it's time for c2 to check what it has
  c1.overlay(aubrey, {thisIsAubrey: true})
})

test('circular structures with arrays', async (t) => {
  t.plan(3)
  const [s, c1, c2] = await start(2)
  c2.on('changed', page => {
    if (page.thisIsAubrey) {
      t.equal(page.name, 'Aubrey')
      t.equal(page.selves[0], page)
      t.equal(page.selves[1], page)
      end(t, s, c1, c2)
    }
  })

  const aubrey = {}

  aubrey.name = 'Aubrey'
  aubrey.selves = [aubrey, aubrey]

  c1.add(aubrey)

  // flag that it's time for c2 to check what it has
  c1.overlay(aubrey, {thisIsAubrey: true})
})

test('complex circular structures with arrays', async (t) => {
  t.plan(8)
  const [s, c1, c2] = await start(2)
  c2.on('changed', page => {
    if (page.thisIsAubrey) {
      t.equal(page.name, 'Aubrey')
      t.equal(page.age, 15)
      t.equal(page.sisters[0].name, 'Cassia')
      t.equal(page.sisters[0].age, 13)
      t.equal(page.sisters[1].name, 'Boudicca')
      t.equal(page.sisters[1].age, 18)
      t.equal(page.sisters[0].sisters[1].sisters[0], page)
      t.equal(page.sisters[1].sisters[1].sisters[0], page)
      end(t, s, c1, c2)
    }
  })

  const aubrey = {}
  const boudicca = {}
  const cassia = {}

  aubrey.name = 'Aubrey'
  aubrey.age = 15
  aubrey.sisters = [cassia, boudicca]

  boudicca.name = 'Boudicca'
  boudicca.age = 18
  boudicca.sisters = [aubrey, cassia]

  cassia.name = 'Cassia'
  cassia.age = 13
  cassia.sisters = [aubrey, boudicca]

  c1.add(aubrey)  // adds cassia because it has to

  // flag that it's time for c2 to check what it has
  c1.overlay(aubrey, {thisIsAubrey: true})
})

test('view', async (t) => {
  t.plan(3)
  const [s, c1] = await start(1)
  /*
    function f (x) {
    return x.name !== undefined && x.hair !== undefined && x.age > 100
    }
  *./
  const v = c1.filter({age: {gr: 100}})
  v.on('appear', page => {
    t.equal(page.name, 'Alice')
    t.equal(page.age, 200)
    t.equal(page.hair, true)
    end(t, s, c1)
  })
  const obj = {name: 'Alice', age: 20, hair: true}
  c1.add(obj)
  c1.overlay(obj, {age: 21})
  c1.overlay(obj, {age: 200})
})
*/
