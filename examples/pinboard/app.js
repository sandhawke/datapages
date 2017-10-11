'use strict'

console.log('hello, world')

const datapages = require('datapages')

const debug = require('debug')('datapages_example_pinboard')

window.localStorage.debug = '*'
debug('debugging')

const db = new datapages.Remote(window.serverAddress)

db.listenSince(0, 'change', (page, delta) => {
  debug('change: %o %o', page, delta)
})

/*
db.create({
  runningAt: document.location.href,
  started: new Date()
})
*/

// quickly puts us in loop, it seem
//
// plus the csv has negative ids in it, which it should not!
