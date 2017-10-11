const { run } = require('webgram/browser-tester')
const datapages = require('..')
const fs = require('fs')
const path = require('path')

// phantomjs isn't working right, it shuts down before sending any output
const browsers = []
browsers.push('firefox')
// browsers.push('chromium')
// const browsers = null

run('test/run-this-in-browsers', {newServer, browsers})

let count = 0

function newServer (options) {
  // we want sessions, so we need set up a new place
  // for the server secrets, every run

  const tmp = fs.mkdtempSync('/tmp/datapages-test-')
  const file = suffix => {
    const result = path.join(tmp, suffix + '_' + ++count)
    console.log('# tmp file', result)
    return result
  }

  const o2 = Object.assign({}, options)
  o2.sessionOptions = {
    serverSecretsDBName: file('serversecret')
  }
  o2.db = new datapages.MinDB()
  o2.useSessions = true

  const s = new datapages.Server(o2)

  return s.transport
}

/*
function serverHook (s) {
  const dps = new datapages.Server({transport: s})

  // ...

}
*/
