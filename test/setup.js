'use strict'

/*

  Make a customized version of the tape (aka "test") object which has
  added helpful methods, useful for the testing we do

*/

const tape = require('tape')
const fs = require('fs')
const path = require('path')
const atEnd = require('tape-end-hook')
const mockDate = require('mockdate')
const webgram = require('webgram')
const datapages = require('..')
const transport = require('./fake-transport')
const debug = require('debug')('dp_test')

mockDate.set('2/1/1988', 120)
const fakeNow = new Date()
debug('date mocked to', fakeNow)

const inBrowser = (typeof window === 'object')

// this is who we ask to create fresh test servers, when we're running
// in the client
let masterServer
if (inBrowser) {
  masterServer = new webgram.Client(undefined, {useSessions: false})
}

tape.debug = debug
tape.setups = []

function filterSetups () {
  const arg = inBrowser ? window.SETUP : process.env.SETUP
  if (arg) {
    console.log('# filtering using SETUP =', arg)
    const index = +arg
    let count = 0
    for (const setup of tape.setups) {
      count++
      if (setup.name.toLowerCase() !== arg.toLowerCase() &&
         count !== index) {
        setup.skip = true
        debug('skipping', setup.name)
      } else {
        debug('keeping', setup.name)
      }
    }
  }
}

// turns into one call to test(...) for each applicable setup, with
// setup.init having a chance to run on the t argument, before test is
// really started.
tape.multi = (...args) => {
  let restrictions = {}
  let name
  let cb
  if (args.length === 2) {
    [name, cb] = args
  } else {
    [restrictions, name, cb] = args
  }
  return multitest(restrictions, name, cb, tape)
}

tape.multi.only = (...args) => {
  // sad copy/paste from above -- seems silly to make own function though
  let restrictions = {}
  let name
  let cb
  if (args.length === 2) {
    [name, cb] = args
  } else {
    [restrictions, name, cb] = args
  }
  return multitest(restrictions, name, cb, tape.only)
}

tape.multi.skip = (restrictions, name, cb) => {

}

// include options:{doOwners:true} if you want the server to be set up
// with doOwners for the test.  The problem is that stuff is noise to a
// lot of tests.

function multitest (restrictions, name, cb, test) {
  const only = restrictions.only
  delete restrictions.only
  const options = restrictions.options || {}
  delete restrictions.options

  for (const setup of tape.setups) {
    debug('multitest setup = %o', setup)
    if (setup.skip) continue
    let wanted = true
    if (only) {
      if (only !== setup.name) wanted = false
      debug('"only" running setup=%j (this is %j, wanted=%s),',
            only, setup.name, wanted)
    } else {
      for (const key of Object.keys(restrictions)) {
        if ((!!setup[key]) !== (!!restrictions[key])) wanted = false
      }
    }
    if (!wanted) continue
    if (inBrowser && !setup.browser) continue

    const rname = name + ' [ SETUP=' + setup.name + ' ]'
    test(rname, async (t) => {
      atEnd(t, () => {
        // t.comment('ended: ' + rname)
      })
      t.debug = debug
      t.deltas = []
      t.logDelta = logDeltaFunc(t)  // maybe call this logSimplifiedDelta
      t.sleep = (ms) => {
        return new Promise((resolve) => {
          setTimeout(resolve, ms)
        })
      }
      t.options = options
      await setup.init(t)
      // might some day make this depend on the setup...
      t.unrelatedDB = (name) => new datapages.InMem({name})
      if (t.db) {
        atEnd(t, () => {
          t.db.close()
        })
      }

      // t.comment('initialized: ' + rname)
      cb(t)
      // t.comment('cb returned: ' + rname)
    })
  }
  debug('multitest %j returning', name)
}

function logDeltaFunc (t) {
  return (delta) => {
    const d = {}
    d.subject = delta.subject
    d.property = delta.property
    d.value = delta.value
    d.oldValue = delta.oldValue
    if (d.oldValue === undefined) delete d.oldValue

    if (typeof d.subject === 'object') {
      const subj = {}
      for (const key of Object.keys(d.subject)) {
        // Object.keys will naturally skip Symbols
        if (key.startsWith('__')) continue
        if (key === '_owner') continue
        subj[key] = d.subject[key]
      }
      d.subject = subj
    }
    t.debug('logging delta, cleaned')
    t.debug(' from %o', delta)
    t.debug(' to   %o', d)
    t.deltas.push(d)
  }
}

function setup (x) {
  tape.setups.push(x)
}

// make a temp directory for a bunch of associate files
// return .dir as name of dir, and .file() as successive files within it
function tmp () {
  return new Promise((resolve, reject) => {
    fs.mkdtemp('/tmp/datapages-test-', (err, dir) => {
      if (err) { reject(err); return }
      let count = 0
      const result = { dir }
      result.file = (suffix) => {
        const result = path.join(dir, suffix + '_' + ++count)
        console.log('# tmp file', result)
        return result
      }
      resolve(result)
    })
  })
}

// make a temp filename
let maintmp
async function tmpfile (suffix) {
  if (!maintmp) {
    maintmp = await tmp()
  }
  return maintmp.file(suffix)
}

// restriction flags
const proxy = true // t.db implements proxy interface (not raw interface)
// const server = true // t.server will be setup, t.anotherClient() defined
// const view = true
const browser = true // this setup works in a browsers (ie okay without fs)
const client = true // t.db is a client
const raw = true // t.db implements raw interface (not proxy interface)
const ws = true // uses websockets

setup({
  name: 'inmem',
  proxy,
  browser,
  init: async (t) => {
    t.db = new datapages.InMem()
  }
})

setup({
  name: 'mindb',
  raw,
  browser,
  init: async (t) => {
    t.db = new datapages.MinDB()
  }
})

// this is the only one right now that DOESN'T work in browser
setup({
  name: 'flatfile',
  init: async (t) => {
    const filename = await tmpfile('flat')
    t.db = new datapages.FlatFile(filename)
  }
})

async function netInit (t, ClientClass, ws) {
  const clientOptions = {}
  const servOpts = {}
  servOpts.doOwners = t.options.doOwners
  debug('doOwners = %s', servOpts.doOwners)
  servOpts.db = new datapages.MinDB()

  if (ws) {
    if (inBrowser) {
      delete servOpts.db // but say we want mindb?
      const answer = await masterServer.ask('newServer', servOpts)
      debug('masterServer responded %o', answer)
      clientOptions.serverAddress = answer.wsAddress
      atEnd(t, () => masterServer.ask('delServer', answer))
    } else {
      servOpts.sessionOptions = {
        serverSecretsDBName: await tmpfile('server-secrets')
      }
      const s = new datapages.Server(servOpts)
      await s.transport.start()
      clientOptions.serverAddress = s.transport.address
      atEnd(t, () => s.close())
    }
  } else {
    const f = new transport.Server()
    servOpts.transport = f
    const s = new datapages.Server(servOpts)
    atEnd(t, () => s.close())
    clientOptions.transport = f.connectedClient()
  }

  // resume will sometimes have us trying to reuse auth for a test server
  // from the past that happened to use the same port
  clientOptions.skipResume = true

  t.db = new ClientClass(clientOptions)

  atEnd(t, () => t.db.close())
}

setup({
  name: 'rawclient-inprocess-mindb-server',
  browser,
  raw,
  client,
  init: async (t) => {
    await netInit(t, datapages.RawClient, false)
  }
})

setup({
  name: 'proxyclient-inprocess-mindb-server',
  browser,
  proxy,
  client,
  init: async (t) => {
    await netInit(t, datapages.Remote, false)
  }
})

setup({
  name: 'rawclient-ws-mindb-server',
  raw,
  client,
  browser, // via our crazy masterServer trick
  ws,
  init: async (t) => {
    await netInit(t, datapages.RawClient, true)
  }
})

setup({
  name: 'proxyclient-ws-mindb-server',
  proxy,
  client,
  browser, // via our crazy masterServer trick
  ws,
  init: async (t) => {
    await netInit(t, datapages.Remote, true)
  }
})

/*
  setup({
  name: 'remote-to-ready-server',
  proxy,
  browser,
  init: async (t) => {
  }
  })
*/

filterSetups()
debug('local setup for tape compete')

module.exports = tape
