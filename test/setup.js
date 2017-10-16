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
const datapages = require('..')
const transport = require('./fake-transport')
const debug = require('debug')('datapages_test')

mockDate.set('2/1/1988', 120)
const fakeNow = new Date()
debug('date mocked to', fakeNow)

tape.debug = debug
tape.setups = []

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

function multitest (restrictions, name, cb, test) {
  for (const setup of tape.setups) {
    debug('multitest setup = %o', setup)
    if (setup.skip) continue
    let wanted = true
    for (const key of Object.keys(restrictions)) {
      if (setup[key] !== restrictions[key]) wanted = false
    }
    if (!wanted) continue
    if (typeof window === 'object') {  // we're in a browser
      if (!setup.browser) continue
    }
    
    const rname = name + ' [setup=' + setup.name + ']'
    test(rname, async (t) => {
      atEnd(t, () => {
        // t.comment('ended: ' + rname)
      })
      t.sleep = (ms) => {
        return new Promise((resolve) => {
          setTimeout(resolve, ms)
        })
      }
      await setup.init(t)
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
const proxy = true // t.db will be like inmem, with proxy objects
const server = true // t.server will be setup, t.anotherClient() defined
// const view = true
const browser = true // should work in browser, too

setup({
  name: 'inmem',
  proxy,
  browser,
  init: async (t) => {
    t.db = new datapages.InMem()
  }
})

setup({
  name: 'flatfile',
  init: async (t) => {
    const filename = await tmpfile('flat')
    t.db = new datapages.FlatFile(filename)
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

const arg = process.env.SETUP
if (arg) {
  console.log('# filtering using SETUP =', arg)
  for (const setup of tape.setups) {
    if (!setup.name.toLowerCase().match(arg.toLowerCase())) {
      setup.skip = true
      debug('skipping', setup.name)
    } else {
      debug('keeping', setup.name)
    }
  }
}

debug('local setup for tape compete')

module.exports = tape
