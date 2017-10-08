'use strict'

console.log('hello, world')

const datapages = require('datapages')

const debug = require('debug')('datapages_example_pinboard')

window.localStorage.debug = '*'
debug('debugging')

const db = new datapages.Client(window.serverAddress)

db.listenSince(0, 'change', (page, delta) => {
  debug('change: %o %o', page, delta)
})

db.create({
  runningAt: document.location.href,
  started: new Date()
})

// need inmem bridge to client

// does that WORK, or does it need a mapping we're missing?
