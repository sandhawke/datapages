'use strict'

// This is called by test-in-*
//
// It calls in-browser-tests.js INSIDE browsers, using tape-run
//
// TODO: with server setup & tear down
//

const run = require('tape-run')
const browserify = require('browserify')
const path = require('path')
const stream = require('stream')
const datapages = require('.')
const fs = require('fs')

// todo: make it run browserify just once

const file = path.join(__dirname, 'in-browser-tests')

// Workaround for tape-run bug: for chrome and firefox, the stream is
// never closed, so to know when to close down the server, we need to
// actually watch the output stream from the browser modules :-(

class EndOfTape extends stream.Transform {
  constructor (hook, settings) {
    super()
    this.hook = hook
    this.settings = settings
  }
  _transform (chunk, enc, cb) {
    console.log('# WatchForEnd _t %o %o', this.settings, chunk.toString('utf8'))
    const str = chunk.toString('utf8')
    if (str.startsWith('# pass')) {
      console.log('# DONE %o', this.settings)
      this.hook()
        .then(() => {
          this.push(chunk)
          cb()
        })
    }
  }
}

// do this, vs modify tape-run vs borrow the browser-driver from tape-run ?
//
// set up tempstatic/.well-knowns/datapages-conf.json as having
// wsAddress points to our server
class Server extends datapages.Server {
  getDir () {
    return new Promise((resolve, reject) => {
      this.transport.start()
        .then(() => {
          const config = { wsAddress: this.transport.address }
          fs.mkdtemp('/tmp/datapages-test-', (err, staticDir) => {
            if (err) throw err
            console.log('# staticDir', staticDir)
            const wkDir = path.join(staticDir, '.well-known')
            fs.mkdir(wkDir, (err, tmp) => {
              if (err) throw err
              console.log('# wkDir', wkDir)
              fs.writeFile(path.join(wkDir, 'webgram.json'),
                           JSON.stringify(config, null, 2),
                           'utf8', (err) => {
                             if (err) throw err
                             resolve(staticDir)
                           })
            })
          })
        })
    })
  }
}

async function main (settings) {
  const s = new Server()
  settings.static = await s.getDir()
  // console.log('getDir returned', settings)

  const tapeRun = run(settings)

  console.log('# running tests via tape-run: %o', settings)
  browserify(file)
    .bundle()
    .pipe(tapeRun)
    .pipe(new EndOfTape(() => {
      console.log('CLOSING SERVER (not really)')
      return s.close()
    }, settings))
    .pipe(process.stdout)
}

module.exports = main
