const { run } = require('webgram/browser-tester')
const datapages = require('..')
const fs = require('fs')
const path = require('path')
const glob = require('glob')
const webgram = require('webgram')
const crypto = require('crypto')
const debug = require('debug')('browser_test')

// phantomjs isn't working right, it shuts down before sending any output
const browsers = []
browsers.push('firefox')
browsers.push('chromium')
// const browsers = null

let setupLine = ''
if (process.env.SETUP) {
  setupLine = `window.SETUP = '${process.env.SETUP}'\n`
}

const filenames = glob.sync('test-*.js', {cwd: 'test'})
fs.writeFileSync('test/all-tests.js',
                 '// auto-generated by browser-test.js\n' +
                 `window.localStorage.debug = ''\n` +
                 setupLine +
                 filenames.map(x => `require('./${x}')\n`).join(''))

run('test/all-tests', {newServer, browsers})

let count = 0

function newServer (options) {
  const o2 = Object.assign({}, options)
  o2.useSessions = false
  const s = new webgram.Server(o2)

  // allow tests running in the browser to say they want a fresh
  // server; reply telling them the wsAddress of the new server
  s.answer.newServer = newDatapagesServer
  s.answer.delServer = delDatapagesServer
  return s
}

const servers = new Map()

async function newDatapagesServer (conn, optionsFromWeb) {
  // we want sessions, so we need set up a new place
  // for the server secrets, every run

  const tmp = fs.mkdtempSync('/tmp/datapages-test-')
  const file = suffix => {
    const result = path.join(tmp, suffix + '_' + ++count)
    console.log('# tmp file', result)
    return result
  }

  const o2 = {}
  o2.sessionOptions = {
    serverSecretsDBName: file('serversecret')
  }
  o2.db = new datapages.MinDB()
  o2.useSessions = true

  // sanitize anything in optionsFromWeb we want
  if (optionsFromWeb.doOwners) o2.doOwners = true

  const s = new datapages.Server(o2)
  await s.transport.start()

  const key = crypto.randomBytes(8).toString('hex')
  const result = { wsAddress: s.transport.address, key }
  debug('started test server %o', result)
  servers.set(key, s)
  debug('servers = %O', servers)
  return result
}

async function delDatapagesServer (conn, args) {
  debug('delDatapagesServer %o', args)
  const s = servers.get(args.key)
  debug('looking up server for key %s, got %o', args.key, s)
  if (s) await s.close()
}
